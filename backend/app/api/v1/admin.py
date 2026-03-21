from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin, require_super_admin
from app.models.admin import Admin
from app.schemas.admin import (
    AdminCreate,
    AdminListResponse,
    AdminPermissionsUpdate,
    AdminResponse,
    AdminUpdate,
)
from app.schemas.common import APIResponse
from app.services.audit import log_action
from app.utils.security import hash_password

router = APIRouter()


@router.get("", response_model=APIResponse)
async def list_admins(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
) -> APIResponse:
    """List all admin accounts. Requires admin+ role."""
    result = await db.execute(
        select(Admin).order_by(Admin.created_at.asc())
    )
    admins = result.scalars().all()

    count_result = await db.execute(select(func.count(Admin.id)))
    total = count_result.scalar_one()

    return APIResponse(
        data=AdminListResponse(
            items=[AdminResponse.model_validate(a) for a in admins],
            total=total,
        ).model_dump()
    )


@router.post("", response_model=APIResponse, status_code=status.HTTP_201_CREATED)
async def create_admin(
    body: AdminCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_super_admin)],
) -> APIResponse:
    """Create a new admin account. Requires super_admin role."""
    # Check username uniqueness
    existing = await db.execute(
        select(Admin).where(Admin.username == body.username)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{body.username}' already exists",
        )

    # Check email uniqueness if provided
    if body.email:
        existing_email = await db.execute(
            select(Admin).where(Admin.email == body.email)
        )
        if existing_email.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email '{body.email}' already exists",
            )

    admin = Admin(
        username=body.username,
        password_hash=hash_password(body.password),
        display_name=body.display_name,
        email=body.email,
        role=body.role,
        is_active=True,
        permissions={},
    )
    db.add(admin)
    await db.flush()
    await db.refresh(admin)

    await log_action(
        db, _current_user.id, "create_admin", "admin", admin.id,
        {"username": admin.username, "role": admin.role},
        request.client.host if request.client else None,
    )

    return APIResponse(
        code=201,
        message="Admin created successfully",
        data=AdminResponse.model_validate(admin).model_dump(),
    )


@router.patch("/{admin_id}", response_model=APIResponse)
async def update_admin(
    admin_id: int,
    body: AdminUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_super_admin)],
) -> APIResponse:
    """Update an admin account. Requires super_admin role."""
    result = await db.execute(select(Admin).where(Admin.id == admin_id))
    admin = result.scalar_one_or_none()

    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found",
        )

    update_data = body.model_dump(exclude_unset=True)

    # Hash password if provided
    if "password" in update_data:
        update_data["password_hash"] = hash_password(update_data.pop("password"))
    else:
        update_data.pop("password", None)

    for field, value in update_data.items():
        setattr(admin, field, value)

    await db.flush()
    await db.refresh(admin)

    return APIResponse(
        message="Admin updated successfully",
        data=AdminResponse.model_validate(admin).model_dump(),
    )


@router.delete("/{admin_id}", response_model=APIResponse)
async def deactivate_admin(
    admin_id: int,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(require_super_admin)],
) -> APIResponse:
    """Deactivate an admin account. Requires super_admin role. Cannot deactivate self."""
    if admin_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )

    result = await db.execute(select(Admin).where(Admin.id == admin_id))
    admin = result.scalar_one_or_none()

    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found",
        )

    admin.is_active = False

    await log_action(
        db, current_user.id, "deactivate_admin", "admin", admin_id,
        {"username": admin.username},
        request.client.host if request.client else None,
    )
    await db.flush()

    return APIResponse(message="Admin deactivated successfully")


@router.patch("/{admin_id}/permissions", response_model=APIResponse)
async def update_admin_permissions(
    admin_id: int,
    body: AdminPermissionsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_super_admin)],
) -> APIResponse:
    """Update an admin's permissions JSON. Requires super_admin role."""
    result = await db.execute(select(Admin).where(Admin.id == admin_id))
    admin = result.scalar_one_or_none()

    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found",
        )

    admin.permissions = body.permissions
    await db.flush()
    await db.refresh(admin)

    return APIResponse(
        message="Permissions updated successfully",
        data=AdminResponse.model_validate(admin).model_dump(),
    )
