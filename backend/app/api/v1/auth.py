from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.config import settings
from app.models.admin import Admin
from app.schemas.auth import LoginRequest, RefreshRequest, TokenResponse, UserInfo
from app.schemas.common import APIResponse
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)

router = APIRouter()


@router.post("/login", response_model=APIResponse)
async def login(
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> APIResponse:
    """Authenticate admin user and return JWT tokens."""
    result = await db.execute(
        select(Admin).where(Admin.username == body.username)
    )
    admin = result.scalar_one_or_none()

    if admin is None or not verify_password(body.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    token_data = {"sub": str(admin.id), "role": admin.role}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return APIResponse(
        data=TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserInfo(
                id=admin.id,
                username=admin.username,
                role=admin.role,
                display_name=admin.display_name,
            ),
        ).model_dump()
    )


@router.post("/refresh", response_model=APIResponse)
async def refresh_token(
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> APIResponse:
    """Refresh the access token using a refresh token."""
    payload = decode_token(body.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    admin_id = payload.get("sub")
    if admin_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    result = await db.execute(select(Admin).where(Admin.id == int(admin_id)))
    admin = result.scalar_one_or_none()

    if admin is None or not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    token_data = {"sub": str(admin.id), "role": admin.role}
    new_access_token = create_access_token(token_data)
    new_refresh_token = create_refresh_token(token_data)

    return APIResponse(
        data=TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserInfo(
                id=admin.id,
                username=admin.username,
                role=admin.role,
                display_name=admin.display_name,
            ),
        ).model_dump()
    )


@router.post("/logout", response_model=APIResponse)
async def logout(
    current_user: Annotated[Admin, Depends(get_current_user)],
) -> APIResponse:
    """Logout (client should discard tokens)."""
    # Token invalidation can be implemented via Redis blacklist later
    return APIResponse(message="Logged out successfully")


@router.get("/me", response_model=APIResponse)
async def get_me(
    current_user: Annotated[Admin, Depends(get_current_user)],
) -> APIResponse:
    """Get current authenticated user info."""
    return APIResponse(
        data=UserInfo(
            id=current_user.id,
            username=current_user.username,
            role=current_user.role,
            display_name=current_user.display_name,
        ).model_dump()
    )
