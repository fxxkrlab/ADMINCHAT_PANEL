"""
Handler for group messages where the bot is @mentioned.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone

from aiogram import Router, F
from aiogram.types import Message as TgMessage
from sqlalchemy import select

from app.database import async_session_factory
from app.models.user import TgUser
from app.models.group import TgGroup, GroupBot
from app.models.conversation import Conversation
from app.models.message import Message
from app.services.realtime import publish_new_message, publish_conversation_update

logger = logging.getLogger(__name__)

router = Router(name="group")


def _extract_mention_text(msg: TgMessage, bot_username: str) -> str | None:
    """
    If the message text contains @bot_username, return the text after the
    mention (stripped). Returns None if the bot was not mentioned.
    """
    if not msg.text:
        return None

    # Check entities for bot_command or mention
    if msg.entities:
        for entity in msg.entities:
            if entity.type == "mention":
                mentioned = msg.text[entity.offset : entity.offset + entity.length]
                if mentioned.lower() == f"@{bot_username.lower()}":
                    # Remove the mention and return the rest
                    remaining = (
                        msg.text[: entity.offset]
                        + msg.text[entity.offset + entity.length :]
                    ).strip()
                    return remaining or None

    # Fallback: regex match
    pattern = re.compile(rf"@{re.escape(bot_username)}", re.IGNORECASE)
    if pattern.search(msg.text):
        return pattern.sub("", msg.text).strip() or None

    return None


def _extract_content(msg: TgMessage) -> tuple[str, str | None, str | None]:
    """Return (content_type, text_content, media_file_id)."""
    if msg.text:
        return "text", msg.text, None
    if msg.photo:
        return "photo", msg.caption, msg.photo[-1].file_id
    if msg.video:
        return "video", msg.caption, msg.video.file_id
    if msg.document:
        return "document", msg.caption, msg.document.file_id
    if msg.sticker:
        return "sticker", None, msg.sticker.file_id
    if msg.voice:
        return "voice", None, msg.voice.file_id
    if msg.animation:
        return "animation", msg.caption, msg.animation.file_id
    return "text", msg.text or "", None


@router.message(F.chat.type.in_({"group", "supergroup"}))
async def handle_group_message(
    message: TgMessage,
    bot_db_id: int,
    bot_username: str,
) -> None:
    """
    Process group messages that mention the bot.
    1. Check if bot is @mentioned
    2. Upsert TgUser
    3. Upsert TgGroup + GroupBot link
    4. Upsert Conversation (source_type='group')
    5. Store Message
    6. Publish to Redis
    """
    tg_user = message.from_user
    if tg_user is None or tg_user.is_bot:
        return

    # Only respond to messages that @mention this bot
    mentioned_text = _extract_mention_text(message, bot_username)
    if mentioned_text is None:
        # Also handle replies to the bot's own messages
        if not (
            message.reply_to_message
            and message.reply_to_message.from_user
            and message.reply_to_message.from_user.username
            and message.reply_to_message.from_user.username.lower()
            == bot_username.lower()
        ):
            return
        mentioned_text = message.text or message.caption or ""

    async with async_session_factory() as session:
        try:
            # ---- 1. Upsert TgUser ----
            result = await session.execute(
                select(TgUser).where(TgUser.tg_uid == tg_user.id)
            )
            db_user = result.scalar_one_or_none()

            if db_user is None:
                db_user = TgUser(
                    tg_uid=tg_user.id,
                    username=tg_user.username,
                    first_name=tg_user.first_name,
                    last_name=tg_user.last_name,
                    language_code=tg_user.language_code,
                    is_premium=tg_user.is_premium or False,
                    is_bot=tg_user.is_bot,
                )
                session.add(db_user)
                await session.flush()
            else:
                db_user.username = tg_user.username
                db_user.first_name = tg_user.first_name
                db_user.last_name = tg_user.last_name
                db_user.last_active_at = datetime.now(timezone.utc)

            # Block check
            if db_user.is_blocked:
                logger.debug("Ignoring group message from blocked user tg_uid=%s", tg_user.id)
                return

            # ---- 2. Upsert TgGroup ----
            chat = message.chat
            result = await session.execute(
                select(TgGroup).where(TgGroup.tg_chat_id == chat.id)
            )
            db_group = result.scalar_one_or_none()

            if db_group is None:
                db_group = TgGroup(
                    tg_chat_id=chat.id,
                    title=chat.title,
                    username=chat.username,
                    group_type=chat.type,
                )
                session.add(db_group)
                await session.flush()
                logger.info("Created TgGroup id=%s chat_id=%s", db_group.id, chat.id)
            else:
                db_group.title = chat.title
                db_group.username = chat.username
                db_group.group_type = chat.type

            # Ensure GroupBot link exists
            result = await session.execute(
                select(GroupBot).where(
                    GroupBot.group_id == db_group.id,
                    GroupBot.bot_id == bot_db_id,
                )
            )
            if result.scalar_one_or_none() is None:
                session.add(GroupBot(group_id=db_group.id, bot_id=bot_db_id))
                await session.flush()

            # ---- 3. Upsert Conversation ----
            result = await session.execute(
                select(Conversation).where(
                    Conversation.tg_user_id == db_user.id,
                    Conversation.source_type == "group",
                    Conversation.source_group_id == db_group.id,
                )
            )
            conv = result.scalar_one_or_none()

            now = datetime.now(timezone.utc)
            if conv is None:
                conv = Conversation(
                    tg_user_id=db_user.id,
                    source_type="group",
                    source_group_id=db_group.id,
                    primary_bot_id=bot_db_id,
                    status="open",
                    last_message_at=now,
                )
                session.add(conv)
                await session.flush()
                logger.info(
                    "Created group conversation id=%s user=%s group=%s",
                    conv.id,
                    db_user.id,
                    db_group.id,
                )
            else:
                conv.last_message_at = now
                if conv.status == "resolved":
                    conv.status = "open"
                    conv.resolved_at = None
                    conv.resolved_by = None

            # ---- 4. Store Message ----
            content_type, text_content, media_file_id = _extract_content(message)
            # For group messages, store the extracted mention text as the primary text
            if content_type == "text":
                text_content = mentioned_text

            db_msg = Message(
                conversation_id=conv.id,
                tg_message_id=message.message_id,
                direction="inbound",
                sender_type="user",
                via_bot_id=bot_db_id,
                content_type=content_type,
                text_content=text_content,
                media_file_id=media_file_id,
                reply_to_message_id=message.reply_to_message.message_id
                if message.reply_to_message
                else None,
                raw_data={},
            )
            session.add(db_msg)
            await session.commit()

            # ---- 5. Publish to Redis ----
            await publish_new_message(
                conversation_id=conv.id,
                message_data={
                    "id": db_msg.id,
                    "conversation_id": conv.id,
                    "direction": "inbound",
                    "sender_type": "user",
                    "content_type": content_type,
                    "text_content": text_content,
                    "media_file_id": media_file_id,
                    "tg_message_id": message.message_id,
                    "created_at": db_msg.created_at.isoformat()
                    if db_msg.created_at
                    else None,
                },
            )
            await publish_conversation_update(
                conversation_id=conv.id,
                status=conv.status,
            )

        except Exception:
            await session.rollback()
            logger.exception(
                "Error handling group message from tg_uid=%s in chat_id=%s",
                tg_user.id if tg_user else "?",
                message.chat.id,
            )
            raise
