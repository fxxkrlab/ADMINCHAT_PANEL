from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_admin
from app.models.admin import Admin
from app.models.tag import Tag, UserTag
from app.models.user_group import UserGroup, UserGroupMember
from app.schemas.common import APIResponse
from app.schemas.user import TagCreate, TagOut, UserGroupCreate, UserGroupOut

router = APIRouter()


# === Tags ===

@router.get("/tags", response_model=APIResponse)
async def list_tags(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(get_current_user)],
) -> APIResponse:
    """List all tags."""
    result = await db.execute(select(Tag).order_by(Tag.name))
    tags = result.scalars().all()

    items = [TagOut(id=t.id, name=t.name, color=t.color).model_dump() for t in tags]
    return APIResponse(data=items)


@router.post("/tags", response_model=APIResponse)
async def create_tag(
    body: TagCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(require_admin)],
) -> APIResponse:
    """Create a new tag."""
    # Check uniqueness
    existing = await db.execute(select(Tag).where(Tag.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tag name already exists")

    tag = Tag(name=body.name, color=body.color)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)

    return APIResponse(
        data=TagOut(id=tag.id, name=tag.name, color=tag.color).model_dump(),
        message="Tag created",
    )


@router.delete("/tags/{tag_id}", response_model=APIResponse)
async def delete_tag(
    tag_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(require_admin)],
) -> APIResponse:
    """Delete a tag."""
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    tag = result.scalar_one_or_none()

    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")

    await db.delete(tag)
    await db.commit()

    return APIResponse(message="Tag deleted")


# === User Groups ===

@router.get("/user-groups", response_model=APIResponse)
async def list_user_groups(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(get_current_user)],
) -> APIResponse:
    """List all user groups with member counts."""
    result = await db.execute(select(UserGroup).order_by(UserGroup.name))
    groups = result.scalars().all()

    items = []
    for group in groups:
        count_result = await db.execute(
            select(func.count()).where(UserGroupMember.group_id == group.id)
        )
        member_count = count_result.scalar() or 0

        items.append(
            UserGroupOut(
                id=group.id,
                name=group.name,
                description=group.description,
                member_count=member_count,
            ).model_dump()
        )

    return APIResponse(data=items)


@router.post("/user-groups", response_model=APIResponse)
async def create_user_group(
    body: UserGroupCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(require_admin)],
) -> APIResponse:
    """Create a new user group."""
    group = UserGroup(name=body.name, description=body.description)
    db.add(group)
    await db.commit()
    await db.refresh(group)

    return APIResponse(
        data=UserGroupOut(id=group.id, name=group.name, description=group.description).model_dump(),
        message="Group created",
    )


@router.delete("/user-groups/{group_id}", response_model=APIResponse)
async def delete_user_group(
    group_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(require_admin)],
) -> APIResponse:
    """Delete a user group."""
    result = await db.execute(select(UserGroup).where(UserGroup.id == group_id))
    group = result.scalar_one_or_none()

    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    await db.delete(group)
    await db.commit()

    return APIResponse(message="Group deleted")
