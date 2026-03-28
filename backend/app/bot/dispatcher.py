"""
Bot Dispatcher — responsible for sending outbound messages from the
Web panel back to Telegram.

Handles:
- Private chats: always use the original (primary) bot
- Group chats: try primary bot first, failover to other bots on 429
- Redis distributed lock to prevent duplicate sends
- Delayed retry queue when all bots are rate-limited
"""
from __future__ import annotations

import logging
import uuid
from typing import Optional

from aiogram import Bot as AiogramBot
from aiogram.exceptions import TelegramRetryAfter, TelegramBadRequest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bot import Bot
from app.models.conversation import Conversation
from app.bot.rate_limiter import (
    is_rate_limited,
    mark_rate_limited,
    get_available_bots,
)
from app.services.redis import get_redis

logger = logging.getLogger(__name__)

# Registry: bot_db_id -> AiogramBot instance (populated by BotManager)
_bot_instances: dict[int, AiogramBot] = {}


def register_bot_instance(bot_db_id: int, bot: AiogramBot) -> None:
    """Called by BotManager when a bot is started."""
    _bot_instances[bot_db_id] = bot


def unregister_bot_instance(bot_db_id: int) -> None:
    """Called by BotManager when a bot is stopped."""
    _bot_instances.pop(bot_db_id, None)


def get_bot_instance(bot_db_id: int) -> Optional[AiogramBot]:
    return _bot_instances.get(bot_db_id)


async def send_message(
    db: AsyncSession,
    conversation: Conversation,
    text_content: str,
    reply_to_message_id: Optional[int] = None,
    parse_mode: Optional[str] = None,
) -> Optional[int]:
    """
    Send a message back to Telegram for the given conversation.

    Returns the tg_message_id on success, None on failure.
    """
    # Determine target chat_id
    if conversation.source_type == "private":
        # Need the TG user's chat_id (same as tg_uid for private chats)
        from app.models.user import TgUser

        result = await db.execute(
            select(TgUser).where(TgUser.id == conversation.tg_user_id)
        )
        tg_user = result.scalar_one_or_none()
        if tg_user is None:
            logger.error("TgUser not found for conversation %s", conversation.id)
            return None
        chat_id = tg_user.tg_uid
    else:
        # Group chat — use source_group's tg_chat_id
        from app.models.group import TgGroup

        result = await db.execute(
            select(TgGroup).where(TgGroup.id == conversation.source_group_id)
        )
        group = result.scalar_one_or_none()
        if group is None:
            logger.error("TgGroup not found for conversation %s", conversation.id)
            return None
        chat_id = group.tg_chat_id

    # ---- Distributed lock (prevent duplicate sends) ----
    msg_uuid = str(uuid.uuid4())
    lock_key = f"msg:lock:{conversation.id}:{msg_uuid}"
    redis = await get_redis()
    acquired = await redis.set(lock_key, "1", nx=True, ex=60)
    if not acquired:
        logger.warning("Duplicate send blocked for conversation %s", conversation.id)
        return None

    # ---- Try primary bot ----
    primary_bot_id = conversation.primary_bot_id
    tg_msg_id = await _try_send(
        primary_bot_id, chat_id, text_content, reply_to_message_id, parse_mode
    )
    if tg_msg_id is not None:
        return tg_msg_id

    # ---- Private chats cannot failover ----
    if conversation.source_type == "private":
        logger.warning(
            "Primary bot %s rate-limited for private conv %s; queuing for retry",
            primary_bot_id,
            conversation.id,
        )
        await _enqueue_retry(redis, conversation.id, text_content, reply_to_message_id)
        return None

    # ---- Group failover: try other bots ----
    available = await get_available_bots(db, exclude_bot_id=primary_bot_id)
    for bot_record in available:
        tg_msg_id = await _try_send(
            bot_record.id, chat_id, text_content, reply_to_message_id, parse_mode
        )
        if tg_msg_id is not None:
            return tg_msg_id

    # All bots are rate-limited
    logger.warning(
        "All bots rate-limited for conv %s; queuing for retry", conversation.id
    )
    await _enqueue_retry(redis, conversation.id, text_content, reply_to_message_id)
    return None


async def _try_send(
    bot_db_id: Optional[int],
    chat_id: int,
    text: str,
    reply_to: Optional[int],
    parse_mode: Optional[str],
) -> Optional[int]:
    """Attempt to send via a specific bot. Returns tg_message_id or None."""
    if bot_db_id is None:
        return None

    if await is_rate_limited(bot_db_id):
        return None

    aiogram_bot = get_bot_instance(bot_db_id)
    if aiogram_bot is None:
        logger.warning("No aiogram instance for bot_db_id=%s", bot_db_id)
        return None

    try:
        result = await aiogram_bot.send_message(
            chat_id=chat_id,
            text=text,
            reply_to_message_id=reply_to,
            parse_mode=parse_mode,
        )
        return result.message_id
    except TelegramRetryAfter as exc:
        await mark_rate_limited(bot_db_id, exc.retry_after)
        logger.warning(
            "Bot %s hit 429, retry_after=%ss", bot_db_id, exc.retry_after
        )
        return None
    except TelegramBadRequest as exc:
        logger.warning("TelegramBadRequest bot=%s: %s", bot_db_id, exc)
        # Retry without reply_to (stale message IDs cause this)
        if reply_to is not None:
            try:
                result = await aiogram_bot.send_message(
                    chat_id=chat_id,
                    text=text,
                    parse_mode=parse_mode,
                )
                logger.info("Sent without reply_to after BadRequest (bot=%s)", bot_db_id)
                return result.message_id
            except Exception:
                logger.exception("Retry without reply_to also failed (bot=%s)", bot_db_id)
        return None
    except Exception:
        logger.exception("Unexpected error sending via bot %s", bot_db_id)
        return None


async def _enqueue_retry(
    redis,
    conversation_id: int,
    text_content: str,
    reply_to_message_id: Optional[int],
) -> None:
    """Add a message to the delayed retry sorted-set for later processing."""
    import json
    import time

    payload = json.dumps(
        {
            "conversation_id": conversation_id,
            "text_content": text_content,
            "reply_to_message_id": reply_to_message_id,
        },
        ensure_ascii=False,
    )
    # Retry after 30 seconds
    score = time.time() + 30
    await redis.zadd("bot:retry:queue", {payload: score})
    logger.info("Enqueued retry for conversation %s", conversation_id)
