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
from app.bot.rate_limiter import get_bot_from_group
from app.bot.dispatcher import get_bot_instance

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

                        logger.debug("FAQ matched: rule_id=%s, reply_mode=%s, answers=%d", faq_result.rule_id, faq_result.reply_mode, len(final_answers))
                        if faq_result.reply_mode == "rag":
                            # RAG mode: search knowledge base, then AI synthesize
                            try:
                                from app.faq.rag import get_rag_provider
                                rag_provider = await get_rag_provider(config_id=faq_result.rag_config_id)
                                if rag_provider:
                                    rag_results = await rag_provider.search(text_content, top_k=settings.RAG_TOP_K)
                                    if rag_results:
                                        rag_context = "\n\n".join(
                                            f"[{r.source}] {r.content}" if r.source else r.content
                                            for r in rag_results
                                        )
                                        from app.faq.ai_handler import AIHandler, AIConfig as AIRuntimeConfig
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
                                                    model=ai_cfg.model or settings.AI_MODEL or "gpt-4o-mini",
                                                    max_tokens=ai_cfg.default_params.get("max_tokens", 500) if ai_cfg.default_params else 500,
                                                    temperature=ai_cfg.default_params.get("temperature", 0.7) if ai_cfg.default_params else 0.7,
                                                    api_format=getattr(ai_cfg, "api_format", "openai_chat") or "openai_chat",
                                                )
                                                ai_resp = await handler.reply_ai_classify_and_answer(
                                                    text_content, rag_context, runtime
                                                )
                                                if ai_resp.content:
                                                    final_answers = [ai_resp.content]
                                                    reply_sender_type = "ai"
                                            finally:
                                                await handler.close()
                                        else:
                                            # No AI config: return raw RAG content
                                            final_answers = [rag_results[0].content]
                                            reply_sender_type = "faq"
                                    else:
                                        logger.info("RAG returned no results, keeping FAQ fallback")
                                else:
                                    logger.warning("reply_mode=rag but RAG provider not configured, falling back to direct")
                            except Exception:
                                logger.exception("RAG processing failed, falling back to direct answer")

                        elif faq_result.reply_mode != "direct" and final_answers:
                            # AI processing modes
                            try:
                                from app.faq.ai_handler import AIHandler, AIConfig as AIRuntimeConfig
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
                                            model=ai_cfg.model or settings.AI_MODEL or "gpt-4o-mini",
                                            max_tokens=ai_cfg.default_params.get("max_tokens", 500) if ai_cfg.default_params else 500,
                                            temperature=ai_cfg.default_params.get("temperature", 0.7) if ai_cfg.default_params else 0.7,
                                            api_format=getattr(ai_cfg, "api_format", "openai_chat") or "openai_chat",
                                        )

                                        if faq_result.reply_mode == "ai_polish":
                                            ai_resp = await handler.reply_ai_polish(
                                                text_content, final_answers[0], runtime
                                            )
                                            if ai_resp.content:
                                                final_answers = [ai_resp.content]
                                                reply_sender_type = "ai"
                                            else:
                                                logger.warning("AI returned empty content, keeping original FAQ answer")
                                        elif faq_result.reply_mode == "ai_only":
                                            ai_resp = await handler.reply_ai_only(text_content, runtime)
                                            if ai_resp.content:
                                                final_answers = [ai_resp.content]
                                                reply_sender_type = "ai"
                                        elif faq_result.reply_mode == "ai_fallback":
                                            pass  # FAQ matched, keep FAQ answer
                                        elif faq_result.reply_mode == "ai_classify_and_answer":
                                            faq_context = "\n".join(final_answers)
                                            ai_resp = await handler.reply_ai_classify_and_answer(
                                                text_content, faq_context, runtime
                                            )
                                            if ai_resp.content:
                                                final_answers = [ai_resp.content]
                                                reply_sender_type = "ai"
                                        else:
                                            pass  # Unknown mode: use preset answer
                                    finally:
                                        await handler.close()
                                else:
                                    logger.warning("AI mode %s but no AI config found, falling back to direct", faq_result.reply_mode)
                            except Exception:
                                logger.exception("AI processing failed for reply_mode=%s, falling back to direct answer", faq_result.reply_mode)

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

                            for answer_text in final_answers:
                                if reply_sender_type == "ai":
                                    label = "✦ AI"
                                else:
                                    label = "✦ FAQ"
                                tg_reply = f"<b>{label}</b>\n\n{answer_text}"

                                # Send via routing bot if available, else original bot
                                sent = False
                                if route_bot:
                                    route_aiogram = get_bot_instance(route_bot.id)
                                    if route_aiogram:
                                        try:
                                            await route_aiogram.send_message(
                                                chat_id=message.chat.id,
                                                text=tg_reply,
                                                parse_mode="HTML",
                                            )
                                            sent = True
                                        except Exception as route_err:
                                            logger.warning(
                                                "Route bot %s failed to send, falling back to original bot: %s",
                                                route_bot.id, route_err,
                                            )
                                if not sent:
                                    await message.answer(tg_reply, parse_mode="HTML")
                                    send_bot_id = bot_db_id

                                # Store reply in DB
                                faq_msg = Message(
                                    conversation_id=conv.id,
                                    direction="outbound",
                                    sender_type=reply_sender_type,
                                    via_bot_id=send_bot_id,
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
