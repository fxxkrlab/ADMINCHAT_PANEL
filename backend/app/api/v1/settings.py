"""
System Settings API endpoints.

GET   /settings          - get all settings as key-value pairs
GET   /settings/version  - get current & latest version info
PATCH /settings          - batch update settings (super_admin)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin, require_super_admin
from app.models.admin import Admin
from app.models.settings import SystemSetting
from app.schemas.common import APIResponse
from app.schemas.settings import SettingItem, SettingsResponse, SettingsUpdate

logger = logging.getLogger(__name__)

router = APIRouter()

# Resolve project root (backend/ is one level up from app/)
_PROJECT_ROOT = Path(__file__).resolve().parents[3]


@router.get("/version", response_model=APIResponse)
async def get_version(
    _current_user: Annotated[Admin, Depends(require_admin)],
) -> APIResponse:
    """Get current and latest version info."""
    version_file = _PROJECT_ROOT / "VERSION"
    build_file = _PROJECT_ROOT / "BUILD_VERSION"

    current_version = version_file.read_text().strip() if version_file.exists() else "unknown"
    build_version = build_file.read_text().strip() if build_file.exists() else "unknown"

    latest_version: str | None = None
    update_available = False

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://raw.githubusercontent.com/fxxkrlab/ADMINCHAT_PANEL/main/VERSION"
            )
            if resp.status_code == 200:
                latest_version = resp.text.strip()
                update_available = latest_version != current_version
    except Exception:
        logger.debug("Failed to fetch latest version from GitHub", exc_info=True)

    return APIResponse(
        data={
            "current_version": current_version,
            "build_version": build_version,
            "latest_version": latest_version,
            "update_available": update_available,
        }
    )


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
    now = datetime.utcnow()

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
