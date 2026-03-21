"""
System Settings API endpoints.

GET   /settings   - get all settings as key-value pairs
PATCH /settings   - batch update settings (super_admin)
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin, require_super_admin
from app.models.admin import Admin
from app.models.settings import SystemSetting
from app.schemas.common import APIResponse
from app.schemas.settings import SettingItem, SettingsResponse, SettingsUpdate

router = APIRouter()


@router.get("", response_model=APIResponse)
async def get_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
) -> APIResponse:
    """Get all system settings. Requires admin+."""
    result = await db.execute(
        select(SystemSetting).order_by(SystemSetting.key)
    )
    settings = result.scalars().all()

    return APIResponse(
        data=SettingsResponse(
            items=[
                SettingItem(
                    key=s.key,
                    value=s.value,
                    description=s.description,
                    updated_at=s.updated_at,
                )
                for s in settings
            ]
        ).model_dump()
    )


@router.patch("", response_model=APIResponse)
async def update_settings(
    body: SettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_super_admin)],
) -> APIResponse:
    """Batch update system settings. Requires super_admin."""
    now = datetime.now(timezone.utc)

    for key, value in body.settings.items():
        result = await db.execute(
            select(SystemSetting).where(SystemSetting.key == key)
        )
        setting = result.scalar_one_or_none()

        if setting is None:
            # Create new setting
            setting = SystemSetting(
                key=key,
                value=value if isinstance(value, dict) else {"value": value},
                updated_at=now,
            )
            db.add(setting)
        else:
            # Update existing
            setting.value = value if isinstance(value, dict) else {"value": value}
            setting.updated_at = now

    await db.flush()

    # Return updated settings
    result = await db.execute(
        select(SystemSetting).order_by(SystemSetting.key)
    )
    settings = result.scalars().all()

    return APIResponse(
        message="Settings updated successfully",
        data=SettingsResponse(
            items=[
                SettingItem(
                    key=s.key,
                    value=s.value,
                    description=s.description,
                    updated_at=s.updated_at,
                )
                for s in settings
            ]
        ).model_dump(),
    )
