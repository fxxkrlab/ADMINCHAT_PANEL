"""
Cloudflare Turnstile verification service.

Verifies Turnstile tokens by calling the CF siteverify API.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.config import settings
from app.models.settings import SystemSetting
from app.models.user import TgUser
from app.schemas.common import APIResponse
from app.schemas.settings import TurnstileVerifyRequest, TurnstileVerifyResponse

logger = logging.getLogger(__name__)

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

router = APIRouter()


async def _get_turnstile_secret(db: AsyncSession) -> str | None:
    """Fetch the Turnstile secret key from system settings."""
    # First check env var
    if settings.TURNSTILE_SECRET_KEY:
        return settings.TURNSTILE_SECRET_KEY
    # Fall back to DB setting
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == "turnstile_secret_key")
    )
    setting = result.scalar_one_or_none()
    if setting is None:
        return None
    val = setting.value
    if isinstance(val, dict):
        return val.get("value")
    return str(val)


async def _get_turnstile_site_key(db: AsyncSession) -> str | None:
    """Fetch the Turnstile site key from env or system settings."""
    if settings.TURNSTILE_SITE_KEY:
        return settings.TURNSTILE_SITE_KEY
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == "turnstile_site_key")
    )
    setting = result.scalar_one_or_none()
    if setting is None:
        return None
    val = setting.value
    if isinstance(val, dict):
        return val.get("value")
    return str(val)


async def verify_turnstile_token(token: str, secret_key: str) -> bool:
    """
    Call the Cloudflare Turnstile siteverify API.

    Args:
        token: The turnstile token from the client.
        secret_key: The Turnstile secret key.

    Returns:
        True if verification succeeded, False otherwise.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(
                TURNSTILE_VERIFY_URL,
                data={
                    "secret": secret_key,
                    "response": token,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("success", False)
        except Exception:
            logger.exception("Turnstile verification failed")
            return False


@router.get("/config", response_model=APIResponse)
async def get_turnstile_config(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> APIResponse:
    """
    Return the Turnstile site key for client-side widget.
    Public endpoint - no auth required.
    """
    site_key = await _get_turnstile_site_key(db)
    if not site_key:
        return APIResponse(
            code=404,
            message="Turnstile is not configured",
            data={"site_key": None},
        )
    return APIResponse(data={"site_key": site_key})


@router.post("/verify", response_model=APIResponse)
async def verify_turnstile(
    body: TurnstileVerifyRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> APIResponse:
    """
    Verify a Cloudflare Turnstile token.
    Public endpoint - no auth required.
    """
    secret_key = await _get_turnstile_secret(db)
    if not secret_key:
        return APIResponse(
            code=500,
            message="Turnstile is not configured",
            data=TurnstileVerifyResponse(
                success=False,
                message="Turnstile secret key not configured",
            ).model_dump(),
        )

    success = await verify_turnstile_token(body.token, secret_key)

    if success:
        # Update tg_users.turnstile_verified_at for body.tg_uid
        result = await db.execute(
            select(TgUser).where(TgUser.tg_uid == body.tg_uid)
        )
        user = result.scalar_one_or_none()
        if user:
            now = datetime.utcnow()
            user.turnstile_verified_at = now
            user.turnstile_expires_at = now + timedelta(
                days=settings.TURNSTILE_TTL_DAYS
            )
            await db.commit()
            logger.info(
                "Turnstile verified for tg_uid=%s, expires=%s",
                body.tg_uid,
                user.turnstile_expires_at,
            )
        else:
            logger.warning(
                "Turnstile verified but tg_uid=%s not found in DB",
                body.tg_uid,
            )

        return APIResponse(
            data=TurnstileVerifyResponse(
                success=True,
                message="Verification successful",
            ).model_dump(),
        )

    return APIResponse(
        code=400,
        message="Verification failed",
        data=TurnstileVerifyResponse(
            success=False,
            message="Turnstile verification failed",
        ).model_dump(),
    )


@router.get("/status/{tg_uid}", response_model=APIResponse)
async def check_turnstile_status(
    tg_uid: int,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> APIResponse:
    """
    Check if a Telegram user has been verified via Turnstile.
    Used by bot handlers to check verification status.
    """
    result = await db.execute(
        select(TgUser).where(TgUser.tg_uid == tg_uid)
    )
    user = result.scalar_one_or_none()

    if not user:
        return APIResponse(
            code=404,
            message="User not found",
            data={"verified": False, "expired": False},
        )

    now = datetime.utcnow()
    verified = user.turnstile_verified_at is not None
    expired = (
        user.turnstile_expires_at is not None
        and user.turnstile_expires_at < now
    )

    return APIResponse(
        data={
            "verified": verified and not expired,
            "expired": expired,
            "verified_at": user.turnstile_verified_at.isoformat()
            if user.turnstile_verified_at
            else None,
            "expires_at": user.turnstile_expires_at.isoformat()
            if user.turnstile_expires_at
            else None,
        }
    )
