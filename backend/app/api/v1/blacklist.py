from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db
from app.models.admin import Admin
from app.models.tag import UserTag
from app.models.user import TgUser
from app.schemas.common import APIResponse, PaginatedData
from app.schemas.user import TagOut

router = APIRouter()


@router.get("", response_model=APIResponse)
async def list_blacklisted_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(get_current_user)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> APIResponse:
    """List all blocked/blacklisted users."""
    base_query = select(TgUser).where(TgUser.is_blocked == True)  # noqa: E712

    # Count
    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar() or 0

    # Paginate
    offset = (page - 1) * page_size
    result = await db.execute(
        base_query
        .options(selectinload(TgUser.user_tags).selectinload(UserTag.tag))
        .order_by(TgUser.last_active_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    users = result.scalars().unique().all()

    items = []
    for user in users:
        tags = [TagOut(id=ut.tag.id, name=ut.tag.name, color=ut.tag.color).model_dump() for ut in user.user_tags]
        items.append({
            "id": user.id,
            "tg_uid": user.tg_uid,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_blocked": user.is_blocked,
            "block_reason": user.block_reason,
            "tags": tags,
            "last_active_at": user.last_active_at.isoformat() if user.last_active_at else None,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        })

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    return APIResponse(
        data=PaginatedData(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        ).model_dump()
    )
