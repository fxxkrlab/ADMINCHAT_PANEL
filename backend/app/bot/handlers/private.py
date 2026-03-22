"""
Handler for private (DM) messages sent to any bot in the pool.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

from aiogram import Router, F
from aiogram.types import Message as TgMessage, InlineKeyboardMarkup, InlineKeyboardButton
from sqlalchemy import select

from app.database import async_session_factory
from app.config import settings
from app.models.user import TgUser
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.stats import FaqHitStat, UnmatchedMessage
from app.services.realtime import publish_new_message, publish_conversation_update
from app.faq.engine import match as faq_match

logger = logging.getLogger(__name__)

router = Router(name="private")


def _extract_content(msg: TgMessage) -> tuple[str, str | None, str | None]:
    """
    Return (content_type, text_content, media_file_id) from a Telegram message.
    """
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
    if msg.video_note:
        return "video_note", None, msg.video_note.file_id
    if msg.animation:
        return "animation", msg.caption, msg.animation.file_id
    if msg.audio:
        return "audio", msg.caption, msg.audio.file_id
    if msg.location:
        return "location", f"{msg.location.latitude},{msg.location.longitude}", None
    if msg.contact:
        return "contact", f"{msg.contact.first_name} {msg.contact.phone_number}", None
    # Fallback
    return "text", msg.text or "", None


def _raw_data(msg: TgMessage) -> dict:
    """Extract a JSON-safe subset of the raw Telegram message."""
    try:
        return msg.model_dump(
            exclude={"bot", "from_user"},
            exclude_none=True,
            mode="json",
        )
    except Exception:
        return {}


@router.message(F.chat.type == "private")
async def handle_private_message(message: TgMessage, bot_db_id: int) -> None:
    """
    Process every private message:
    1. Upsert TgUser
    2. Check blocked / Turnstile
    3. Upsert Conversation
    4. Store Message
    5. Publish to Redis for WebSocket
    """
    tg_user = message.from_user
    if tg_user is None or tg_user.is_bot:
        return

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
                logger.info("Created TgUser id=%s tg_uid=%s", db_user.id, tg_user.id)
            else:
                # Update volatile fields
                db_user.username = tg_user.username
                db_user.first_name = tg_user.first_name
                db_user.last_name = tg_user.last_name
                db_user.language_code = tg_user.language_code
                db_user.is_premium = tg_user.is_premium or False
                db_user.last_active_at = datetime.utcnow()

            # ---- 2. Block check ----
            if db_user.is_blocked:
                logger.debug("Ignoring message from blocked user tg_uid=%s", tg_user.id)
                return

            # ---- 2b. Turnstile verification check ----
            if settings.TURNSTILE_SECRET_KEY:
                now = datetime.utcnow()
                if (
                    db_user.turnstile_verified_at is None
                    or (
                        db_user.turnstile_expires_at is not None
                        and db_user.turnstile_expires_at < now
                    )
                ):
                    verify_url = (
                        f"{settings.WEBHOOK_BASE_URL or 'https://your-domain.com'}"
                        f"/verify?uid={tg_user.id}"
                    )
                    keyboard = InlineKeyboardMarkup(
                        inline_keyboard=[
                            [
                                InlineKeyboardButton(
                                    text="Complete Verification",
                                    url=verify_url,
                                )
                            ]
                        ]
                    )
                    await message.answer(
                        "Please complete human verification before sending messages:",
                        reply_markup=keyboard,
                    )
                    logger.info(
                        "Sent Turnstile verification link to tg_uid=%s", tg_user.id
                    )
                    await session.commit()
                    return

            # ---- 3. Upsert Conversation ----
            result = await session.execute(
                select(Conversation).where(
                    Conversation.tg_user_id == db_user.id,
                    Conversation.source_type == "private",
                    Conversation.primary_bot_id == bot_db_id,
                )
            )
            conv = result.scalar_one_or_none()

            now = datetime.utcnow()
            if conv is None:
                conv = Conversation(
                    tg_user_id=db_user.id,
                    source_type="private",
                    primary_bot_id=bot_db_id,
                    status="open",
                    last_message_at=now,
                )
                session.add(conv)
                await session.flush()
                logger.info("Created conversation id=%s for tg_uid=%s", conv.id, tg_user.id)
            else:
                conv.last_message_at = now
                if conv.status == "resolved":
                    conv.status = "open"
                    conv.resolved_at = None
                    conv.resolved_by = None

            # ---- 4. Store Message ----
            content_type, text_content, media_file_id = _extract_content(message)

            # Use Telegram's message.date as the actual send time
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
                raw_data=_raw_data(message),
                created_at=msg_time,
            )
            session.add(db_msg)
            await session.flush()

            # ---- 4b. FAQ Engine matching ----
            faq_replied = False
            if text_content:
                try:
                    faq_result = await faq_match(text_content, session)
                    if faq_result:
                        # Record match on the message
                        db_msg.faq_matched = True
                        db_msg.faq_rule_id = faq_result.rule_id

                        # Record hit stats
                        from datetime import date as date_type

                        today = date_type.today()
                        hit_result = await session.execute(
                            select(FaqHitStat).where(
                                FaqHitStat.faq_rule_id == faq_result.rule_id,
                                FaqHitStat.question_id == faq_result.matched_question_id,
                                FaqHitStat.date == today,
                            )
                        )
                        hit_stat = hit_result.scalar_one_or_none()
                        if hit_stat:
                            hit_stat.hit_count += 1
                            hit_stat.last_hit_at = now
                        else:
                            session.add(
                                FaqHitStat(
                                    faq_rule_id=faq_result.rule_id,
                                    question_id=faq_result.matched_question_id,
                                    hit_count=1,
                                    last_hit_at=now,
                                    date=today,
                                )
                            )

                        # Process reply based on reply_mode
                        final_answers = list(faq_result.answers) if faq_result.answers else []
                        reply_sender_type = "faq"

                        if faq_result.reply_mode != "direct" and final_answers:
                            # AI processing modes
                            try:
                                from app.faq.ai_handler import AIHandler, AIConfig as AIRuntimeConfig
                                from app.models.ai_config import AiConfig

                                # Get first active AI config
                                ai_cfg_result = await session.execute(
                                    select(AiConfig).where(AiConfig.is_active.is_(True)).limit(1)
                                )
                                ai_cfg = ai_cfg_result.scalar_one_or_none()

                                if ai_cfg:
                                    handler = AIHandler()
                                    runtime = AIRuntimeConfig(
                                        base_url=ai_cfg.base_url,
                                        api_key=ai_cfg.api_key,
                                        model=ai_cfg.model or "gpt-5-codex",
                                        max_tokens=ai_cfg.default_params.get("max_tokens", 500) if ai_cfg.default_params else 500,
                                        temperature=ai_cfg.default_params.get("temperature", 0.7) if ai_cfg.default_params else 0.7,
                                        api_format=getattr(ai_cfg, "api_format", "openai_chat") or "openai_chat",
                                    )

                                    if faq_result.reply_mode == "ai_polish":
                                        # Polish the preset answer with AI
                                        logger.info("AI Polish: question=%s, answer=%s", text_content, final_answers[0])
                                        ai_resp = await handler.reply_ai_polish(
                                            text_content, final_answers[0], runtime
                                        )
                                        logger.info("AI Polish result: content='%s', tokens=%d", ai_resp.content[:100] if ai_resp.content else "EMPTY", ai_resp.tokens_used)
                                        if ai_resp.content:
                                            final_answers = [ai_resp.content]
                                            reply_sender_type = "ai"
                                        else:
                                            logger.warning("AI returned empty content, keeping original FAQ answer")
                                    elif faq_result.reply_mode == "ai_only":
                                        ai_resp = await handler.reply_ai_only(text_content, runtime)
                                        final_answers = [ai_resp.content]
                                        reply_sender_type = "ai"
                                    elif faq_result.reply_mode == "ai_fallback":
                                        # FAQ matched, so use FAQ answer (AI only if no match)
                                        pass  # keep final_answers as-is
                                    elif faq_result.reply_mode == "ai_classify_and_answer":
                                        faq_context = "\n".join(final_answers)
                                        ai_resp = await handler.reply_ai_classify_and_answer(
                                            text_content, faq_context, runtime
                                        )
                                        final_answers = [ai_resp.content]
                                        reply_sender_type = "ai"
                                    else:
                                        # Other modes: use preset answer for now
                                        pass

                                    await handler.close()
                                else:
                                    logger.warning("AI mode %s but no AI config found, falling back to direct", faq_result.reply_mode)
                            except Exception:
                                logger.exception("AI processing failed for reply_mode=%s, falling back to direct answer", faq_result.reply_mode)

                        if final_answers:
                            for answer_text in final_answers:
                                # Prepend prefix based on sender type
                                if reply_sender_type == "ai":
                                    tg_reply = f"来自AI回复\n\n{answer_text}"
                                else:
                                    tg_reply = f"基于FAQ自动回复\n\n{answer_text}"
                                await message.answer(tg_reply)

                                # Store reply in DB
                                faq_msg = Message(
                                    conversation_id=conv.id,
                                    direction="outbound",
                                    sender_type=reply_sender_type,
                                    via_bot_id=bot_db_id,
                                    content_type="text",
                                    text_content=answer_text,
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
                                        "text_content": answer_text,
                                        "faq_matched": True,
                                        "faq_rule_id": faq_result.rule_id,
                                        "created_at": faq_msg.created_at.isoformat(),
                                    },
                                )

                            faq_replied = True
                            logger.info(
                                "FAQ auto-reply sent for rule_id=%s to tg_uid=%s",
                                faq_result.rule_id,
                                tg_user.id,
                            )
                    else:
                        # No match: record as unmatched for missed knowledge analysis
                        session.add(
                            UnmatchedMessage(
                                tg_user_id=db_user.id,
                                text_content=text_content,
                            )
                        )
                except Exception:
                    logger.exception("FAQ matching error for tg_uid=%s", tg_user.id)

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
                "Error handling private message from tg_uid=%s",
                tg_user.id if tg_user else "?",
            )
            raise
