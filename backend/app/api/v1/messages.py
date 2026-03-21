from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.admin import Admin
from app.models.bot import Bot
from app.models.conversation import Conversation
from app.models.faq import FaqRule
from app.models.message import Message
from app.schemas.common import APIResponse, PaginatedData
from app.schemas.message import MessageCreate, MessageOut

router = APIRouter()


def _build_message_out(msg: Message, bot_name: Optional[str] = None,
                        admin_name: Optional[str] = None,
                        faq_rule_name: Optional[str] = None) -> MessageOut:
    media_url = None
    if msg.media_file_id:
        media_url = f"/api/v1/messages/{msg.id}/media"

    return MessageOut(
        id=msg.id,
        conversation_id=msg.conversation_id,
        direction=msg.direction,
        sender_type=msg.sender_type,
        sender_admin_id=msg.sender_admin_id,
        sender_admin_name=admin_name,
        via_bot_id=msg.via_bot_id,
        via_bot_name=bot_name,
        content_type=msg.content_type,
        text_content=msg.text_content,
        media_url=media_url,
        reply_to_message_id=msg.reply_to_message_id,
        faq_matched=msg.faq_matched,
        faq_rule_id=msg.faq_rule_id,
        faq_rule_name=faq_rule_name,
        created_at=msg.created_at,
    )


@router.get("/{conversation_id}/messages")
async def get_messages(
    conversation_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(get_current_user)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> APIResponse:
    """Get message history for a conversation (newest first)."""
    # Verify conversation exists
    conv_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = conv_result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    # Count total messages
    count_query = select(func.count()).where(Message.conversation_id == conversation_id)
    total = (await db.execute(count_query)).scalar() or 0

    # Fetch messages (newest first)
    offset = (page - 1) * page_size
    query = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(desc(Message.created_at))
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(query)
    messages = result.scalars().all()

    # Batch-load related names
    bot_ids = {m.via_bot_id for m in messages if m.via_bot_id}
    admin_ids = {m.sender_admin_id for m in messages if m.sender_admin_id}
    faq_rule_ids = {m.faq_rule_id for m in messages if m.faq_rule_id}

    bot_names: dict[int, str] = {}
    if bot_ids:
        bots_result = await db.execute(select(Bot).where(Bot.id.in_(bot_ids)))
        for bot in bots_result.scalars():
            bot_names[bot.id] = bot.bot_username or bot.display_name or f"Bot#{bot.id}"

    admin_names: dict[int, str] = {}
    if admin_ids:
        from app.models.admin import Admin as AdminModel
        admins_result = await db.execute(select(AdminModel).where(AdminModel.id.in_(admin_ids)))
        for admin in admins_result.scalars():
            admin_names[admin.id] = admin.display_name or admin.username

    faq_rule_names: dict[int, str] = {}
    if faq_rule_ids:
        rules_result = await db.execute(select(FaqRule).where(FaqRule.id.in_(faq_rule_ids)))
        for rule in rules_result.scalars():
            faq_rule_names[rule.id] = rule.name

    items = [
        _build_message_out(
            msg,
            bot_name=bot_names.get(msg.via_bot_id) if msg.via_bot_id else None,
            admin_name=admin_names.get(msg.sender_admin_id) if msg.sender_admin_id else None,
            faq_rule_name=faq_rule_names.get(msg.faq_rule_id) if msg.faq_rule_id else None,
        )
        for msg in messages
    ]

    total_pages = (total + page_size - 1) // page_size
    paginated = PaginatedData[MessageOut](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )

    return APIResponse(data=paginated.model_dump())


@router.post("/{conversation_id}/messages")
async def send_message(
    conversation_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(get_current_user)],
    content_type: str = Form("text"),
    text_content: Optional[str] = Form(None),
    parse_mode: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
) -> APIResponse:
    """Send a message in a conversation.

    Supports text (with Markdown) or multipart file upload.
    """
    # Verify conversation exists
    conv_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = conv_result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    # Determine content type from file if present
    actual_content_type = content_type
    media_file_id = None

    if file:
        # In production, this would:
        # 1. Upload file via bot API to Telegram
        # 2. Get the file_id back
        # 3. Store it
        # For now, we store the message and note the file
        if file.content_type and file.content_type.startswith("image/"):
            actual_content_type = "photo"
        elif file.content_type and file.content_type.startswith("video/"):
            actual_content_type = "video"
        else:
            actual_content_type = "document"
        # Placeholder: In production, send file via bot and get file_id
        media_file_id = f"pending_upload_{file.filename}"

    if not text_content and not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either text_content or file must be provided",
        )

    # Create the outbound message record
    message = Message(
        conversation_id=conversation_id,
        direction="outbound",
        sender_type="admin",
        sender_admin_id=current_user.id,
        via_bot_id=conv.primary_bot_id,
        content_type=actual_content_type,
        text_content=text_content,
        media_file_id=media_file_id,
        raw_data={"parse_mode": parse_mode} if parse_mode else {},
        created_at=datetime.now(timezone.utc),
    )
    db.add(message)

    # Update conversation last_message_at
    conv.last_message_at = datetime.now(timezone.utc)

    # If conversation was resolved, reopen it
    if conv.status == "resolved":
        conv.status = "open"
        conv.resolved_at = None
        conv.resolved_by = None

    await db.flush()
    await db.refresh(message)

    # TODO: In production:
    # 1. Route through bot dispatcher to send via Telegram
    # 2. Publish via Redis for WebSocket broadcast

    # Get bot name for response
    bot_name = None
    if conv.primary_bot_id:
        bot_result = await db.execute(select(Bot).where(Bot.id == conv.primary_bot_id))
        bot = bot_result.scalar_one_or_none()
        if bot:
            bot_name = bot.bot_username or bot.display_name

    msg_out = _build_message_out(
        message,
        bot_name=bot_name,
        admin_name=current_user.display_name or current_user.username,
    )

    return APIResponse(
        data=msg_out.model_dump(),
        message="Message sent",
    )
