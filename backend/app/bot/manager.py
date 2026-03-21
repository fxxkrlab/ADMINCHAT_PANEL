"""
BotManager — manages multiple aiogram Bot + Dispatcher instances.

Supports both webhook and long-polling modes, switchable via BOT_MODE env var.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
from typing import Dict, Optional

from aiogram import Bot as AiogramBot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import Update
from sqlalchemy import select

from app.config import settings
from app.database import async_session_factory
from app.models.bot import Bot
from app.bot.handlers.private import router as private_router
from app.bot.handlers.group import router as group_router
from app.bot.handlers.commands import router as commands_router
from app.bot.dispatcher import register_bot_instance, unregister_bot_instance

logger = logging.getLogger(__name__)


class _BotEntry:
    """Internal state for a single managed bot."""

    __slots__ = ("db_id", "token", "username", "aiogram_bot", "dp", "polling_task")

    def __init__(
        self,
        db_id: int,
        token: str,
        username: str,
        aiogram_bot: AiogramBot,
        dp: Dispatcher,
    ):
        self.db_id = db_id
        self.token = token
        self.username = username
        self.aiogram_bot = aiogram_bot
        self.dp = dp
        self.polling_task: Optional[asyncio.Task] = None


class BotManager:
    """
    Lifecycle manager for all Telegram bots.

    Usage:
        manager = BotManager()
        await manager.start()   # called in FastAPI lifespan
        ...
        await manager.stop()    # called on shutdown
    """

    def __init__(self) -> None:
        self._bots: Dict[int, _BotEntry] = {}
        self._started = False

    # ------------------------------------------------------------------ #
    #  Public API                                                         #
    # ------------------------------------------------------------------ #

    async def start(self) -> None:
        """Load all active bots from DB and start them."""
        if self._started:
            return

        async with async_session_factory() as session:
            result = await session.execute(
                select(Bot).where(Bot.is_active.is_(True))
            )
            bots = result.scalars().all()

        for bot_record in bots:
            try:
                await self._start_single_bot(bot_record.id, bot_record.token)
            except Exception:
                logger.exception(
                    "Failed to start bot id=%s (%s)",
                    bot_record.id,
                    bot_record.bot_username,
                )

        self._started = True
        logger.info(
            "BotManager started: %d bots active (mode=%s)",
            len(self._bots),
            settings.BOT_MODE,
        )

    async def stop(self) -> None:
        """Gracefully shut down all bots."""
        for entry in list(self._bots.values()):
            await self._stop_single_bot(entry)
        self._bots.clear()
        self._started = False
        logger.info("BotManager stopped")

    async def add_bot(self, bot_db_id: int, token: str) -> str:
        """
        Dynamically add and start a new bot at runtime.
        Returns the bot username.
        """
        if bot_db_id in self._bots:
            return self._bots[bot_db_id].username
        username = await self._start_single_bot(bot_db_id, token)
        return username

    async def remove_bot(self, bot_db_id: int) -> None:
        """Remove and stop a bot at runtime."""
        entry = self._bots.get(bot_db_id)
        if entry is None:
            return
        await self._stop_single_bot(entry)
        del self._bots[bot_db_id]
        logger.info("Bot %s removed at runtime", bot_db_id)

    async def restart_bot(self, bot_db_id: int) -> None:
        """Restart a specific bot (stop then start)."""
        entry = self._bots.get(bot_db_id)
        if entry is None:
            raise ValueError(f"Bot {bot_db_id} is not running")
        token = entry.token
        await self._stop_single_bot(entry)
        del self._bots[bot_db_id]
        await self._start_single_bot(bot_db_id, token)
        logger.info("Bot %s restarted", bot_db_id)

    def get_entry(self, bot_db_id: int) -> Optional[_BotEntry]:
        return self._bots.get(bot_db_id)

    @property
    def active_bot_ids(self) -> list[int]:
        return list(self._bots.keys())

    # ------------------------------------------------------------------ #
    #  Webhook handling (called from FastAPI route)                       #
    # ------------------------------------------------------------------ #

    async def feed_webhook_update(self, token_hash: str, data: dict) -> bool:
        """
        Route an incoming webhook payload to the correct dispatcher.
        Returns True if handled, False if no matching bot found.
        """
        for entry in self._bots.values():
            if self._hash_token(entry.token) == token_hash:
                update = Update.model_validate(data, context={"bot": entry.aiogram_bot})
                await entry.dp.feed_update(
                    entry.aiogram_bot,
                    update,
                )
                return True
        return False

    # ------------------------------------------------------------------ #
    #  Internals                                                          #
    # ------------------------------------------------------------------ #

    async def _start_single_bot(self, bot_db_id: int, token: str) -> str:
        """Create aiogram Bot + Dispatcher, register handlers, start."""
        aiogram_bot = AiogramBot(
            token=token,
            default=DefaultBotProperties(parse_mode=ParseMode.HTML),
        )

        # Validate the token by calling getMe
        me = await aiogram_bot.get_me()
        username = me.username or f"bot_{me.id}"

        # Create dispatcher with middleware-injected bot_db_id
        dp = Dispatcher()

        # Register routers
        dp.include_router(commands_router)
        dp.include_router(private_router)
        dp.include_router(group_router)

        # Middleware to inject bot_db_id and bot_username into handler kwargs
        @dp.message.outer_middleware()
        async def inject_bot_context(handler, event, data):
            data["bot_db_id"] = bot_db_id
            data["bot_username"] = username
            return await handler(event, data)

        entry = _BotEntry(
            db_id=bot_db_id,
            token=token,
            username=username,
            aiogram_bot=aiogram_bot,
            dp=dp,
        )

        # Register in dispatcher module so outbound sends can find this bot
        register_bot_instance(bot_db_id, aiogram_bot)

        if settings.BOT_MODE == "webhook":
            await self._setup_webhook(entry)
        else:
            await self._start_polling(entry)

        self._bots[bot_db_id] = entry

        # Update DB with bot info
        async with async_session_factory() as session:
            result = await session.execute(
                select(Bot).where(Bot.id == bot_db_id)
            )
            bot_record = result.scalar_one_or_none()
            if bot_record:
                bot_record.bot_username = username
                bot_record.bot_id = me.id
                await session.commit()

        logger.info(
            "Bot started: id=%s username=@%s mode=%s",
            bot_db_id,
            username,
            settings.BOT_MODE,
        )
        return username

    async def _stop_single_bot(self, entry: _BotEntry) -> None:
        """Stop a single bot (cancel polling or delete webhook)."""
        unregister_bot_instance(entry.db_id)

        if entry.polling_task and not entry.polling_task.done():
            entry.polling_task.cancel()
            try:
                await entry.polling_task
            except asyncio.CancelledError:
                pass

        if settings.BOT_MODE == "webhook":
            try:
                await entry.aiogram_bot.delete_webhook(drop_pending_updates=False)
            except Exception:
                logger.warning("Failed to delete webhook for bot %s", entry.db_id)

        await entry.aiogram_bot.session.close()
        logger.info("Bot stopped: id=%s @%s", entry.db_id, entry.username)

    async def _setup_webhook(self, entry: _BotEntry) -> None:
        """Register the Telegram webhook URL for this bot."""
        if not settings.WEBHOOK_BASE_URL:
            raise ValueError(
                "WEBHOOK_BASE_URL must be set when BOT_MODE=webhook"
            )

        token_hash = self._hash_token(entry.token)
        webhook_url = (
            f"{settings.WEBHOOK_BASE_URL}{settings.WEBHOOK_PATH}/{token_hash}"
        )
        await entry.aiogram_bot.set_webhook(
            url=webhook_url,
            drop_pending_updates=True,
            allowed_updates=[
                "message",
                "edited_message",
                "callback_query",
            ],
        )
        logger.info("Webhook set for bot %s: %s", entry.db_id, webhook_url)

    async def _start_polling(self, entry: _BotEntry) -> None:
        """Start long-polling in a background task."""
        # Delete any existing webhook first
        try:
            await entry.aiogram_bot.delete_webhook(drop_pending_updates=True)
        except Exception:
            pass

        async def _poll():
            try:
                await entry.dp.start_polling(
                    entry.aiogram_bot,
                    polling_timeout=30,
                )
            except asyncio.CancelledError:
                pass
            except Exception:
                logger.exception("Polling error for bot %s", entry.db_id)

        entry.polling_task = asyncio.create_task(_poll())

    @staticmethod
    def _hash_token(token: str) -> str:
        """SHA-256 hash of the bot token for use in webhook URLs."""
        return hashlib.sha256(token.encode()).hexdigest()


# Module-level singleton
bot_manager = BotManager()
