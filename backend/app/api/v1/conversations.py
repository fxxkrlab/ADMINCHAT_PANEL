from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String as SAString, and_, cast, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db, require_admin
from app.models.admin import Admin
from app.models.bot import Bot
from app.models.conversation import Conversation
from app.models.group import TgGroup
from app.models.message import Message
from app.models.tag import Tag, UserTag
from app.models.user import TgUser
from app.schemas.common import APIResponse, PaginatedData
from app.schemas.conversation import (
    AdminBrief,
    BotBrief,
    ConversationAssign,
    ConversationDetail,
    ConversationListItem,
    ConversationStatusUpdate,
    LastMessagePreview,
    SourceGroupBrief,
    TagOut,
    UserBrief,
)

router = APIRouter()


def _build_user_brief(tg_user: TgUser, tags: list) -> UserBrief:
    return UserBrief(
        id=tg_user.id,
        tg_uid=tg_user.tg_uid,
        username=tg_user.username,
        first_name=tg_user.first_name,
        last_name=tg_user.last_name,
        is_premium=tg_user.is_premium,
        dc_id=tg_user.dc_id,
        phone_region=tg_user.phone_region,
        is_blocked=tg_user.is_blocked,
        photo_url=f"/api/v1/users/{tg_user.id}/photo" if tg_user.photo_file_id else None,
        tags=[TagOut(id=t.id, name=t.name, color=t.color) for t in tags],
    )


@router.get("")
async def list_conversations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(get_current_user)],
    status_filter: Optional[str] = Query(None, alias="status"),
    source_type: Optional[str] = Query(None),
    assigned_to: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    sort: str = Query("last_message_at"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> APIResponse:
    """List conversations with filtering and pagination."""
    # Base query
    query = select(Conversation).options(
        selectinload(Conversation.tg_user).selectinload(TgUser.user_tags).selectinload(UserTag.tag),
        selectinload(Conversation.source_group),
        selectinload(Conversation.assigned_admin),
    )

    # Filters
    conditions = []
    if status_filter:
        conditions.append(Conversation.status == status_filter)
    if source_type:
        conditions.append(Conversation.source_type == source_type)
    if assigned_to is not None:
        conditions.append(Conversation.assigned_to == assigned_to)
    if search:
        # Search by username, first_name, or tg_uid
        query = query.join(TgUser, Conversation.tg_user_id == TgUser.id)
        search_term = f"%{search}%"
        conditions.append(
            (TgUser.username.ilike(search_term))
            | (TgUser.first_name.ilike(search_term))
            | (TgUser.last_name.ilike(search_term))
            | (cast(TgUser.tg_uid, SAString).like(search_term))
        )

    if conditions:
        query = query.where(and_(*conditions))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Sort
    if sort == "created_at":
        query = query.order_by(desc(Conversation.created_at))
    else:
        query = query.order_by(desc(Conversation.last_message_at).nulls_last())

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    conversations = result.scalars().unique().all()

    # Build response items
    items = []
    for conv in conversations:
        tg_user = conv.tg_user
        tags = [ut.tag for ut in (tg_user.user_tags or [])]

        # Get last message
        last_msg_query = (
            select(Message)
            .where(Message.conversation_id == conv.id)
            .order_by(desc(Message.created_at))
            .limit(1)
        )
        last_msg_result = await db.execute(last_msg_query)
        last_msg = last_msg_result.scalar_one_or_none()

        # Count unread (inbound messages since last resolved or creation)
        unread_query = select(func.count()).where(
            and_(
                Message.conversation_id == conv.id,
                Message.direction == "inbound",
            )
        )
        if conv.resolved_at:
            unread_query = unread_query.where(Message.created_at > conv.resolved_at)
        unread_count = (await db.execute(unread_query)).scalar() or 0

        # Get bot info
        bot_brief = None
        if conv.primary_bot_id:
            bot_result = await db.execute(select(Bot).where(Bot.id == conv.primary_bot_id))
            bot = bot_result.scalar_one_or_none()
            if bot:
                bot_brief = BotBrief(
                    id=bot.id,
                    bot_username=bot.bot_username,
                    display_name=bot.display_name,
                )

        item = ConversationListItem(
            id=conv.id,
            user=_build_user_brief(tg_user, tags),
            source_type=conv.source_type,
            source_group=SourceGroupBrief(
                id=conv.source_group.id,
                title=conv.source_group.title,
                tg_chat_id=conv.source_group.tg_chat_id,
            ) if conv.source_group else None,
            status=conv.status,
            assigned_to=conv.assigned_to,
            assigned_admin=AdminBrief(
                id=conv.assigned_admin.id,
                username=conv.assigned_admin.username,
                display_name=conv.assigned_admin.display_name,
            ) if conv.assigned_admin else None,
            primary_bot=bot_brief,
            last_message=LastMessagePreview(
                id=last_msg.id,
                text_content=last_msg.text_content,
                content_type=last_msg.content_type,
                created_at=last_msg.created_at,
            ) if last_msg else None,
            unread_count=unread_count,
            last_message_at=conv.last_message_at,
            created_at=conv.created_at,
        )
        items.append(item)

    total_pages = (total + page_size - 1) // page_size
    paginated = PaginatedData[ConversationListItem](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )

    return APIResponse(data=paginated.model_dump())


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(get_current_user)],
) -> APIResponse:
    """Get conversation detail."""
    query = (
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(
            selectinload(Conversation.tg_user).selectinload(TgUser.user_tags).selectinload(UserTag.tag),
            selectinload(Conversation.source_group),
            selectinload(Conversation.assigned_admin),
        )
    )
    result = await db.execute(query)
    conv = result.scalar_one_or_none()

    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    tg_user = conv.tg_user
    tags = [ut.tag for ut in (tg_user.user_tags or [])]

    # Unread count
    unread_query = select(func.count()).where(
        and_(
            Message.conversation_id == conv.id,
            Message.direction == "inbound",
        )
    )
    if conv.resolved_at:
        unread_query = unread_query.where(Message.created_at > conv.resolved_at)
    unread_count = (await db.execute(unread_query)).scalar() or 0

    # Bot info
    bot_brief = None
    if conv.primary_bot_id:
        bot_result = await db.execute(select(Bot).where(Bot.id == conv.primary_bot_id))
        bot = bot_result.scalar_one_or_none()
        if bot:
            bot_brief = BotBrief(
                id=bot.id,
                bot_username=bot.bot_username,
                display_name=bot.display_name,
            )

    detail = ConversationDetail(
        id=conv.id,
        user=_build_user_brief(tg_user, tags),
        source_type=conv.source_type,
        source_group=SourceGroupBrief(
            id=conv.source_group.id,
            title=conv.source_group.title,
            tg_chat_id=conv.source_group.tg_chat_id,
        ) if conv.source_group else None,
        status=conv.status,
        assigned_to=conv.assigned_to,
        assigned_admin=AdminBrief(
            id=conv.assigned_admin.id,
            username=conv.assigned_admin.username,
            display_name=conv.assigned_admin.display_name,
        ) if conv.assigned_admin else None,
        primary_bot=bot_brief,
        unread_count=unread_count,
        last_message_at=conv.last_message_at,
        resolved_at=conv.resolved_at,
        resolved_by=conv.resolved_by,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )

    return APIResponse(data=detail.model_dump())


@router.patch("/{conversation_id}/status")
async def update_conversation_status(
    conversation_id: int,
    body: ConversationStatusUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(get_current_user)],
) -> APIResponse:
    """Update conversation status (open/resolved)."""
    if body.status not in ("open", "resolved"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be 'open' or 'resolved'",
        )

    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = result.scalar_one_or_none()

    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    old_status = conv.status
    conv.status = body.status

    if body.status == "resolved":
        conv.resolved_at = datetime.utcnow()
        conv.resolved_by = current_user.id
    elif body.status == "open" and old_status == "resolved":
        # Reopening - clear resolved info
        conv.resolved_at = None
        conv.resolved_by = None

    await db.flush()

    return APIResponse(
        data={"id": conv.id, "status": conv.status},
        message=f"Conversation status updated to {body.status}",
    )


@router.patch("/{conversation_id}/assign")
async def assign_conversation(
    conversation_id: int,
    body: ConversationAssign,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(require_admin)],
) -> APIResponse:
    """Assign conversation to an agent (admin+ only)."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = result.scalar_one_or_none()

    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    # Verify the target admin exists if assigning
    if body.assigned_to is not None:
        admin_result = await db.execute(
            select(Admin).where(Admin.id == body.assigned_to)
        )
        target_admin = admin_result.scalar_one_or_none()
        if not target_admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target admin not found",
            )

    conv.assigned_to = body.assigned_to
    await db.flush()

    return APIResponse(
        data={"id": conv.id, "assigned_to": conv.assigned_to},
        message="Conversation assignment updated",
    )
