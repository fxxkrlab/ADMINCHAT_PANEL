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
from app.models.stats import FaqHitStat, UnmatchedMessage
from app.services.realtime import publish_new_message, publish_conversation_update
from app.faq.engine import match as faq_match
from app.bot.rate_limiter import get_bot_from_group
from app.bot.dispatcher import get_bot_instance

logger = logging.getLogger(__name__)

router = Router(name="group")


def _extract_mention_text(msg: TgMessage, bot_username: str) -> str | None:
    """
    If the message text or caption contains @bot_username, return the text
    after the mention (stripped). Returns None if the bot was not mentioned.
    Handles both text messages and media with captions.
    """
    # Use text or caption (photos/videos use caption)
    text = msg.text or msg.caption
    entities = msg.entities or msg.caption_entities

    if not text:
        return None

    # Check entities for mention
    if entities:
        for entity in entities:
            if entity.type == "mention":
                mentioned = text[entity.offset : entity.offset + entity.length]
                if mentioned.lower() == f"@{bot_username.lower()}":
                    remaining = (
                        text[: entity.offset]
                        + text[entity.offset + entity.length :]
                    ).strip()
                    return remaining if remaining else ""

    # Fallback: regex match
    pattern = re.compile(rf"@{re.escape(bot_username)}", re.IGNORECASE)
    if pattern.search(text):
        result = pattern.sub("", text).strip()
        return result if result else ""

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

    # Handle anonymous senders (channel masks / anonymous admins)
    # sender_chat is set when someone sends as a channel identity
    is_anonymous = tg_user is None or (message.sender_chat is not None)

    if tg_user is None and message.sender_chat is None:
        return  # Truly unknown sender, skip

    # For anonymous senders, create a pseudo-user from sender_chat info
    if is_anonymous and message.sender_chat:
        # Use sender_chat as the identity
        class _AnonUser:
            def __init__(self, chat):
                self.id = chat.id
                self.is_bot = False
                self.first_name = chat.title or "Anonymous"
                self.last_name = None
                self.username = chat.username
                self.language_code = None
                self.is_premium = False
        tg_user = _AnonUser(message.sender_chat)
    elif tg_user is not None and tg_user.is_bot:
        return  # Skip actual bots (not channel identities)

    # Only respond to messages that @mention this bot
    logger.info(
        "Group message from user=%s in chat=%s text=%s bot_username=%s",
        tg_user.id, message.chat.id, (message.text or "")[:50], bot_username,
    )
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
                db_user.last_active_at = datetime.utcnow()

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

            now = datetime.utcnow()
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

            msg_time = message.date.replace(tzinfo=None) if message.date else datetime.utcnow()

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
                created_at=msg_time,
            )
            session.add(db_msg)
            await session.flush()

            # ---- 4b. FAQ matching for group messages ----
            faq_text = mentioned_text or text_content
            if faq_text and content_type == "text":
                try:
                    faq_result = await faq_match(faq_text, session)
                    if faq_result:
                        db_msg.faq_matched = True
                        db_msg.faq_rule_id = faq_result.rule_id

                        # Record hit
                        from datetime import date as date_type
                        today = date_type.today()
                        hit_result = await session.execute(
                            select(FaqHitStat).where(
                                FaqHitStat.faq_rule_id == faq_result.rule_id,
                                FaqHitStat.date == today,
                            )
                        )
                        hit_stat = hit_result.scalar_one_or_none()
                        if hit_stat:
                            hit_stat.hit_count += 1
                            hit_stat.last_hit_at = datetime.utcnow()
                        else:
                            session.add(FaqHitStat(
                                faq_rule_id=faq_result.rule_id,
                                hit_count=1,
                                last_hit_at=datetime.utcnow(),
                                date=today,
                            ))

                        # Process reply based on reply_mode
                        final_answers = list(faq_result.answers) if faq_result.answers else []
                        reply_sender_type = "faq"

                        if faq_result.reply_mode == "rag":
                            # RAG mode: search knowledge base, then AI synthesize
                            try:
                                from app.faq.rag import get_rag_provider
                                from app.config import settings as app_settings
                                rag_provider = await get_rag_provider(config_id=faq_result.rag_config_id)
                                faq_text_for_rag = mentioned_text or text_content or ""
                                if rag_provider and faq_text_for_rag:
                                    rag_results = await rag_provider.search(faq_text_for_rag, top_k=app_settings.RAG_TOP_K)
                                    if rag_results:
                                        rag_context = "\n\n".join(
                                            f"[{r.source}] {r.content}" if r.source else r.content
                                            for r in rag_results
                                        )
                                        from app.faq.ai_handler import AIHandler, AIConfig as AIRuntimeConfig, log_ai_usage
                                        from app.models.ai_config import AiConfig

                                        ai_cfg_result = await session.execute(
                                            select(AiConfig).where(AiConfig.is_active.is_(True)).limit(1)
                                        )
                                        ai_cfg = ai_cfg_result.scalar_one_or_none()
                                        if ai_cfg:
                                            handler = AIHandler()
                                            try:
                                                runtime = AIRuntimeConfig(
                                                    base_url=ai_cfg.base_url,
                                                    api_key=ai_cfg.api_key,
                                                    model=ai_cfg.model or app_settings.AI_MODEL or "gpt-4o-mini",
                                                    max_tokens=ai_cfg.default_params.get("max_tokens", 500) if ai_cfg.default_params else 500,
                                                    temperature=ai_cfg.default_params.get("temperature", 0.7) if ai_cfg.default_params else 0.7,
                                                    api_format=getattr(ai_cfg, "api_format", "openai_chat") or "openai_chat",
                                                )
                                                ai_resp = await handler.reply_ai_classify_and_answer(
                                                    faq_text_for_rag, rag_context, runtime
                                                )
                                                if ai_resp.content:
                                                    final_answers = [ai_resp.content]
                                                    reply_sender_type = "ai"
                                                await log_ai_usage(session, ai_cfg.id, db_user.id, ai_resp, "rag")
                                            finally:
                                                await handler.close()
                                        else:
                                            final_answers = [rag_results[0].content]
                                            reply_sender_type = "faq"
                                    else:
                                        logger.info("RAG returned no results, keeping FAQ fallback")
                                else:
                                    logger.warning("reply_mode=rag but RAG provider not configured, falling back to direct")
                            except Exception:
                                logger.exception("RAG processing failed in group handler, falling back to direct")

                        elif faq_result.reply_mode != "direct" and final_answers:
                            try:
                                from app.faq.ai_handler import AIHandler, AIConfig as AIRuntimeConfig, log_ai_usage
                                from app.models.ai_config import AiConfig

                                ai_cfg_result = await session.execute(
                                    select(AiConfig).where(AiConfig.is_active.is_(True)).limit(1)
                                )
                                ai_cfg = ai_cfg_result.scalar_one_or_none()

                                if ai_cfg:
                                    handler = AIHandler()
                                    try:
                                        runtime = AIRuntimeConfig(
                                            base_url=ai_cfg.base_url,
                                            api_key=ai_cfg.api_key,
                                            model=ai_cfg.model or "gpt-4o-mini",
                                            max_tokens=ai_cfg.default_params.get("max_tokens", 500) if ai_cfg.default_params else 500,
                                            temperature=ai_cfg.default_params.get("temperature", 0.7) if ai_cfg.default_params else 0.7,
                                            api_format=getattr(ai_cfg, "api_format", "openai_chat") or "openai_chat",
                                        )

                                        faq_text_for_ai = mentioned_text or text_content or ""
                                        if faq_result.reply_mode == "ai_polish":
                                            ai_resp = await handler.reply_ai_polish(faq_text_for_ai, final_answers[0], runtime)
                                            if ai_resp.content:
                                                final_answers = [ai_resp.content]
                                                reply_sender_type = "ai"
                                            await log_ai_usage(session, ai_cfg.id, db_user.id, ai_resp, "ai_polish")
                                        elif faq_result.reply_mode == "ai_only":
                                            ai_resp = await handler.reply_ai_only(faq_text_for_ai, runtime)
                                            if ai_resp.content:
                                                final_answers = [ai_resp.content]
                                                reply_sender_type = "ai"
                                            await log_ai_usage(session, ai_cfg.id, db_user.id, ai_resp, "ai_only")
                                        elif faq_result.reply_mode == "ai_classify_and_answer":
                                            faq_context = "\n".join(final_answers)
                                            ai_resp = await handler.reply_ai_classify_and_answer(faq_text_for_ai, faq_context, runtime)
                                            if ai_resp.content:
                                                final_answers = [ai_resp.content]
                                                reply_sender_type = "ai"
                                            await log_ai_usage(session, ai_cfg.id, db_user.id, ai_resp, "ai_classify_and_answer")
                                    finally:
                                        await handler.close()
                            except Exception:
                                logger.exception("AI processing failed in group handler")

                        if final_answers:
                            # Determine which bot to use for sending
                            send_bot_id = bot_db_id
                            route_bot = None
                            if faq_result.bot_group_id:
                                route_bot = await get_bot_from_group(session, faq_result.bot_group_id)
                                if route_bot:
                                    send_bot_id = route_bot.id
                                    logger.info(
                                        "FAQ routing: using bot id=%s from group %s",
                                        route_bot.id, faq_result.bot_group_id,
                                    )

                            for answer in final_answers:
                                try:
                                    if reply_sender_type == "ai":
                                        label = "✦ AI"
                                    else:
                                        label = "✦ FAQ"
                                    tg_reply = f"<b>{label}</b>\n\n{answer}"

                                    # Send via routing bot if available
                                    if route_bot:
                                        route_aiogram = get_bot_instance(route_bot.id)
                                        if route_aiogram:
                                            await route_aiogram.send_message(
                                                chat_id=message.chat.id,
                                                text=tg_reply,
                                                reply_to_message_id=message.message_id,
                                                parse_mode="HTML",
                                            )
                                        else:
                                            await message.reply(tg_reply, parse_mode="HTML")
                                    else:
                                        await message.reply(tg_reply, parse_mode="HTML")

                                    faq_msg = Message(
                                        conversation_id=conv.id,
                                        direction="outbound",
                                        sender_type=reply_sender_type,
                                        via_bot_id=send_bot_id,
                                        content_type="text",
                                        text_content=answer,
                                        faq_matched=True,
                                        faq_rule_id=faq_result.rule_id,
                                        created_at=datetime.utcnow(),
                                    )
                                    session.add(faq_msg)
                                    await session.flush()

                                    await publish_new_message(
                                        conversation_id=conv.id,
                                        message_data={
                                            "id": faq_msg.id,
                                            "conversation_id": conv.id,
                                            "direction": "outbound",
                                            "sender_type": reply_sender_type,
                                            "content_type": "text",
                                            "text_content": answer,
                                            "faq_matched": True,
                                            "faq_rule_id": faq_result.rule_id,
                                            "created_at": faq_msg.created_at.isoformat(),
                                        },
                                    )
                                except Exception:
                                    logger.warning("Failed to send FAQ reply in group")
                            logger.info("FAQ matched in group: rule=%s", faq_result.rule_id)
                    else:
                        # Store for missed knowledge analysis
                        session.add(UnmatchedMessage(
                            tg_user_id=db_user.id,
                            text_content=faq_text,
                        ))
                except Exception:
                    logger.exception("FAQ matching error in group handler")

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
