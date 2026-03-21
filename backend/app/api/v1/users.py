from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db, require_admin
from app.models.admin import Admin
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.tag import Tag, UserTag
from app.models.user import TgUser
from app.models.user_group import UserGroup, UserGroupMember
from app.schemas.common import APIResponse, PaginatedData
from app.services.audit import log_action
from app.schemas.user import (
    AddTagRequest,
    AddUserToGroupRequest,
    BlockRequest,
    TagOut,
    UserDetail,
    UserGroupOut,
    UserListItem,
    ConversationBrief,
)

router = APIRouter()


@router.get("", response_model=APIResponse)
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(get_current_user)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    tag: Optional[str] = Query(default=None),
    group_id: Optional[int] = Query(default=None),
    is_blocked: Optional[bool] = Query(default=None),
) -> APIResponse:
    """List users with pagination, search, and filtering."""
    base_query = select(TgUser)

    # Search filter: by tg_uid, username, or first_name
    if search:
        if search.isdigit():
            base_query = base_query.where(TgUser.tg_uid == int(search))
        else:
            base_query = base_query.where(
                (TgUser.username.ilike(f"%{search}%"))
                | (TgUser.first_name.ilike(f"%{search}%"))
                | (TgUser.last_name.ilike(f"%{search}%"))
            )

    # Tag filter
    if tag:
        base_query = base_query.join(UserTag, UserTag.user_id == TgUser.id).join(
            Tag, Tag.id == UserTag.tag_id
        ).where(Tag.name.ilike(f"%{tag}%"))

    # Group filter
    if group_id:
        base_query = base_query.join(
            UserGroupMember, UserGroupMember.user_id == TgUser.id
        ).where(UserGroupMember.group_id == group_id)

    # Blocked filter
    if is_blocked is not None:
        base_query = base_query.where(TgUser.is_blocked == is_blocked)

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    offset = (page - 1) * page_size
    users_query = (
        base_query
        .options(selectinload(TgUser.user_tags).selectinload(UserTag.tag))
        .order_by(TgUser.last_active_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(users_query)
    users = result.scalars().unique().all()

    # Build items with message counts
    items = []
    for user in users:
        # Get message count
        msg_count_result = await db.execute(
            select(func.count(Message.id))
            .join(Conversation, Conversation.id == Message.conversation_id)
            .where(Conversation.tg_user_id == user.id)
            .where(Message.direction == "inbound")
        )
        msg_count = msg_count_result.scalar() or 0

        tags = [TagOut(id=ut.tag.id, name=ut.tag.name, color=ut.tag.color) for ut in user.user_tags]

        items.append(
            UserListItem(
                id=user.id,
                tg_uid=user.tg_uid,
                username=user.username,
                first_name=user.first_name,
                last_name=user.last_name,
                is_premium=user.is_premium,
                dc_id=user.dc_id,
                phone_region=user.phone_region,
                is_blocked=user.is_blocked,
                tags=tags,
                message_count=msg_count,
                last_active_at=user.last_active_at,
            )
        )

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    return APIResponse(
        data=PaginatedData(
            items=[item.model_dump() for item in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        ).model_dump()
    )


@router.get("/search", response_model=APIResponse)
async def search_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(get_current_user)],
    tg_uid: Optional[int] = Query(default=None),
    username: Optional[str] = Query(default=None),
    tag: Optional[str] = Query(default=None),
    group_id: Optional[int] = Query(default=None),
) -> APIResponse:
    """Search users by TGUID, username, or tag."""
    query = select(TgUser).options(
        selectinload(TgUser.user_tags).selectinload(UserTag.tag)
    )

    if tg_uid:
        query = query.where(TgUser.tg_uid == tg_uid)
    if username:
        query = query.where(TgUser.username.ilike(f"%{username}%"))
    if tag:
        query = query.join(UserTag, UserTag.user_id == TgUser.id).join(
            Tag, Tag.id == UserTag.tag_id
        ).where(Tag.name.ilike(f"%{tag}%"))
    if group_id:
        query = query.join(
            UserGroupMember, UserGroupMember.user_id == TgUser.id
        ).where(UserGroupMember.group_id == group_id)

    query = query.order_by(TgUser.last_active_at.desc()).limit(50)
    result = await db.execute(query)
    users = result.scalars().unique().all()

    items = []
    for user in users:
        tags = [TagOut(id=ut.tag.id, name=ut.tag.name, color=ut.tag.color) for ut in user.user_tags]
        items.append(
            UserListItem(
                id=user.id,
                tg_uid=user.tg_uid,
                username=user.username,
                first_name=user.first_name,
                last_name=user.last_name,
                is_premium=user.is_premium,
                dc_id=user.dc_id,
                phone_region=user.phone_region,
                is_blocked=user.is_blocked,
                tags=tags,
                message_count=0,
                last_active_at=user.last_active_at,
            )
        )

    return APIResponse(data=[item.model_dump() for item in items])


@router.get("/{user_id}", response_model=APIResponse)
async def get_user_detail(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(get_current_user)],
) -> APIResponse:
    """Get full user detail with tags, groups, and stats."""
    result = await db.execute(
        select(TgUser)
        .where(TgUser.id == user_id)
        .options(
            selectinload(TgUser.user_tags).selectinload(UserTag.tag),
            selectinload(TgUser.user_group_members).selectinload(UserGroupMember.group),
            selectinload(TgUser.conversations),
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Count total messages
    msg_count_result = await db.execute(
        select(func.count(Message.id))
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(Conversation.tg_user_id == user.id)
        .where(Message.direction == "inbound")
    )
    total_messages = msg_count_result.scalar() or 0

    tags = [TagOut(id=ut.tag.id, name=ut.tag.name, color=ut.tag.color) for ut in user.user_tags]
    groups = [
        UserGroupOut(id=ugm.group.id, name=ugm.group.name, description=ugm.group.description)
        for ugm in user.user_group_members
    ]
    conversations = [
        ConversationBrief(
            id=c.id,
            source_type=c.source_type,
            status=c.status,
            last_message_at=c.last_message_at,
            created_at=c.created_at,
        )
        for c in user.conversations
    ]

    turnstile_verified = user.turnstile_verified_at is not None

    detail = UserDetail(
        id=user.id,
        tg_uid=user.tg_uid,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        language_code=user.language_code,
        is_premium=user.is_premium,
        dc_id=user.dc_id,
        phone_region=user.phone_region,
        is_blocked=user.is_blocked,
        block_reason=user.block_reason,
        tags=tags,
        groups=groups,
        turnstile_verified=turnstile_verified,
        turnstile_expires_at=user.turnstile_expires_at,
        first_seen_at=user.first_seen_at,
        last_active_at=user.last_active_at,
        total_messages=total_messages,
        conversations_count=len(user.conversations),
        conversations=conversations,
    )

    return APIResponse(data=detail.model_dump())


@router.post("/{user_id}/block", response_model=APIResponse)
async def block_user(
    user_id: int,
    body: BlockRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(require_admin)],
) -> APIResponse:
    """Block a user with an optional reason."""
    result = await db.execute(select(TgUser).where(TgUser.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_blocked = True
    user.block_reason = body.reason
    await log_action(
        db, current_user.id, "block_user", "user", user_id,
        {"reason": body.reason, "tg_uid": user.tg_uid},
        request.client.host if request.client else None,
    )
    await db.commit()

    return APIResponse(message="User blocked successfully")


@router.post("/{user_id}/unblock", response_model=APIResponse)
async def unblock_user(
    user_id: int,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(require_admin)],
) -> APIResponse:
    """Unblock a user."""
    result = await db.execute(select(TgUser).where(TgUser.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_blocked = False
    user.block_reason = None
    await log_action(
        db, current_user.id, "unblock_user", "user", user_id,
        {"tg_uid": user.tg_uid},
        request.client.host if request.client else None,
    )
    await db.commit()

    return APIResponse(message="User unblocked successfully")


@router.post("/{user_id}/tags", response_model=APIResponse)
async def add_tag_to_user(
    user_id: int,
    body: AddTagRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(get_current_user)],
) -> APIResponse:
    """Add a tag to a user."""
    # Verify user exists
    user_result = await db.execute(select(TgUser).where(TgUser.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Verify tag exists
    tag_result = await db.execute(select(Tag).where(Tag.id == body.tag_id))
    tag = tag_result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")

    # Check if already assigned
    existing = await db.execute(
        select(UserTag).where(
            UserTag.user_id == user_id,
            UserTag.tag_id == body.tag_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tag already assigned")

    user_tag = UserTag(user_id=user_id, tag_id=body.tag_id, created_by=current_user.id)
    db.add(user_tag)
    await db.commit()

    return APIResponse(
        message="Tag added",
        data=TagOut(id=tag.id, name=tag.name, color=tag.color).model_dump(),
    )


@router.delete("/{user_id}/tags/{tag_id}", response_model=APIResponse)
async def remove_tag_from_user(
    user_id: int,
    tag_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(get_current_user)],
) -> APIResponse:
    """Remove a tag from a user."""
    result = await db.execute(
        select(UserTag).where(
            UserTag.user_id == user_id,
            UserTag.tag_id == tag_id,
        )
    )
    user_tag = result.scalar_one_or_none()

    if not user_tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag assignment not found")

    await db.delete(user_tag)
    await db.commit()

    return APIResponse(message="Tag removed")


@router.post("/{user_id}/groups", response_model=APIResponse)
async def add_user_to_group(
    user_id: int,
    body: AddUserToGroupRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(get_current_user)],
) -> APIResponse:
    """Add a user to a group."""
    # Verify user exists
    user_result = await db.execute(select(TgUser).where(TgUser.id == user_id))
    if not user_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Verify group exists
    group_result = await db.execute(select(UserGroup).where(UserGroup.id == body.group_id))
    group = group_result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    # Check if already a member
    existing = await db.execute(
        select(UserGroupMember).where(
            UserGroupMember.user_id == user_id,
            UserGroupMember.group_id == body.group_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already in group")

    member = UserGroupMember(user_id=user_id, group_id=body.group_id)
    db.add(member)
    await db.commit()

    return APIResponse(message="User added to group")


@router.get("/{user_id}/photo")
async def get_user_photo(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(get_current_user)],
) -> Response:
    """Proxy TG user avatar.

    In production this would download the photo via Bot API and cache briefly.
    For now, returns a placeholder SVG.
    """
    result = await db.execute(select(TgUser).where(TgUser.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Generate a deterministic color from the user ID
    colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F"]
    color = colors[user.id % len(colors)]

    # Get initials
    initials = ""
    if user.first_name:
        initials += user.first_name[0].upper()
    if user.last_name:
        initials += user.last_name[0].upper()
    if not initials and user.username:
        initials = user.username[0].upper()
    if not initials:
        initials = "?"

    # Return SVG avatar placeholder
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="40" fill="{color}"/>
  <text x="40" y="40" font-family="Inter, sans-serif" font-size="28" font-weight="600"
    fill="white" text-anchor="middle" dominant-baseline="central">{initials}</text>
</svg>"""

    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=300"},
    )
