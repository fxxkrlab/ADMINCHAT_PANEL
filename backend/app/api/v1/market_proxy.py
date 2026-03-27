"""Proxy endpoints for ACP Market API calls."""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Annotated, Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.api.deps import get_db, require_admin
from app.models.admin import Admin
from app.models.settings import SystemSetting
from app.oauth.encryption import encrypt_oauth_data, decrypt_oauth_data
from app.schemas.common import APIResponse
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

MARKET_SETTINGS_KEY = "market_auth"


# ---- Schemas ----

class MarketConnectRequest(BaseModel):
    method: str  # "login" or "api_key"
    email: Optional[str] = None
    password: Optional[str] = None
    api_key: Optional[str] = None


# ---- Auth helpers ----

async def _get_market_auth_headers(db: AsyncSession) -> Dict[str, str]:
    """Get auth headers for Market API calls.

    Priority: env var > stored credentials.
    Env var is treated as a JWT access token (legacy compat).
    """
    env_key = settings.ACP_MARKET_API_KEY
    if env_key:
        return {"Authorization": f"Bearer {env_key}"}

    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == MARKET_SETTINGS_KEY)
    )
    stored = result.scalar_one_or_none()
    if not stored or not stored.value:
        return {}

    try:
        data = decrypt_oauth_data(stored.value)
    except ValueError:
        logger.warning("Failed to decrypt market auth credentials")
        return {}

    token = data.get("access_token")
    if not token:
        return {}

    return {"Authorization": f"Bearer {token}"}


async def _market_request(
    method: str,
    path: str,
    db: AsyncSession | None = None,
    auth: bool = False,
    **kwargs,
) -> dict:
    """Forward a request to Market API.

    Args:
        method: HTTP method
        path: API path (appended to MARKET_API_URL)
        db: Database session (required if auth=True)
        auth: Whether to include auth headers
        **kwargs: Passed to httpx.request
    """
    headers = kwargs.pop("headers", {})
    if auth and db:
        auth_headers = await _get_market_auth_headers(db)
        headers.update(auth_headers)

    url = f"{settings.ACP_MARKET_URL}{path}"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(method, url, headers=headers, **kwargs)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        status_code = e.response.status_code
        # Pass through 401/403 as-is; everything else becomes 502
        if status_code in (401, 403):
            raise HTTPException(status_code=status_code, detail="Market authentication failed")
        raise HTTPException(status_code=502, detail=f"Market API error: HTTP {status_code}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Cannot reach Market API: {type(e).__name__}")
    except ValueError:
        # json() failed — non-JSON response
        raise HTTPException(status_code=502, detail="Market returned an invalid response")


def _is_env_connected() -> bool:
    """Check if Market auth is set via environment variable."""
    return bool(settings.ACP_MARKET_API_KEY)


async def _try_fetch_public_key(db: AsyncSession) -> None:
    """Best-effort fetch of Market's public key after connecting."""
    try:
        data = await _market_request("GET", "/signing/public-key")
        public_key = data.get("data", {}).get("public_key")
        if not public_key:
            return

        # Cache in system_settings
        result = await db.execute(
            select(SystemSetting).where(SystemSetting.key == "market_public_key")
        )
        existing = result.scalar_one_or_none()
        record = {"public_key": public_key, "fetched_at": datetime.now(timezone.utc).isoformat()}
        if existing:
            existing.value = record
        else:
            db.add(SystemSetting(
                key="market_public_key",
                value=record,
                description="Market Ed25519 public key for bundle verification",
            ))
        await db.commit()

        # Update runtime verifier
        try:
            from app.plugins.loader import get_plugin_manager
            pm = get_plugin_manager()
            pm._verifier.set_public_key_pem(public_key)
        except Exception:
            pass
        logger.info("Market public key fetched and cached successfully")
    except Exception as e:
        logger.debug("Could not fetch Market public key: %s", e)


# ---- New endpoints: connect / status / disconnect ----

@router.post("/market/connect")
async def market_connect(
    body: MarketConnectRequest,
    _admin: Annotated[Admin, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> APIResponse:
    """Connect to ACP Market via login or API key."""
    if _is_env_connected():
        raise HTTPException(
            status_code=400,
            detail="Market is already connected via environment variable. Cannot override from UI.",
        )

    if body.method == "login":
        if not body.email or not body.password:
            raise HTTPException(status_code=400, detail="Email and password are required")

        # Call Market's login endpoint
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{settings.ACP_MARKET_URL}/auth/login",
                    json={"email": body.email, "password": body.password},
                )
                if resp.status_code == 401:
                    raise HTTPException(status_code=401, detail="Invalid email or password")
                resp.raise_for_status()
                login_data = resp.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid email or password")
            raise HTTPException(status_code=502, detail=f"Market login failed: {e.response.status_code}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Cannot reach Market: {e}")

        # Extract tokens — Market may nest under "data" or return flat
        token_data = login_data.get("data", login_data)
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        if not access_token:
            raise HTTPException(status_code=502, detail="Market did not return an access token")

        # Encrypt and store
        encrypted = encrypt_oauth_data({
            "access_token": access_token,
            "refresh_token": refresh_token or "",
        })
        auth_record: Dict[str, Any] = {
            **encrypted,
            "auth_type": "jwt",
            "connected_at": datetime.now(timezone.utc).isoformat(),
        }

    elif body.method == "api_key":
        if not body.api_key:
            raise HTTPException(status_code=400, detail="API key is required")

        # Validate by calling /auth/me with the key as Bearer token
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    f"{settings.ACP_MARKET_URL}/auth/me",
                    headers={"Authorization": f"Bearer {body.api_key}"},
                )
                if resp.status_code == 401:
                    raise HTTPException(status_code=401, detail="Invalid API key")
                resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid API key")
            raise HTTPException(status_code=502, detail=f"Market validation failed: {e.response.status_code}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Cannot reach Market: {e}")

        encrypted = encrypt_oauth_data({
            "access_token": body.api_key,
            "refresh_token": "",
        })
        auth_record = {
            **encrypted,
            "auth_type": "api_key",
            "connected_at": datetime.now(timezone.utc).isoformat(),
        }
    else:
        raise HTTPException(status_code=400, detail="method must be 'login' or 'api_key'")

    # Fetch account info while we have a fresh token
    account = await _fetch_market_account_fresh(auth_record)
    if account:
        auth_record["cached_account"] = account

    # Upsert into system_settings
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == MARKET_SETTINGS_KEY)
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.value = auth_record
    else:
        db.add(SystemSetting(key=MARKET_SETTINGS_KEY, value=auth_record, description="ACP Market auth credentials"))
    await db.commit()

    # Auto-fetch public key after connecting
    await _try_fetch_public_key(db)

    return APIResponse(data={"connected": True, "auth_type": auth_record["auth_type"], "account": account})


@router.get("/market/status")
async def market_status(
    _admin: Annotated[Admin, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> APIResponse:
    """Get Market connection status and account info."""
    # Check env var first
    if _is_env_connected():
        return APIResponse(data={
            "connected": True,
            "auth_type": "env",
            "source": "environment_variable",
            "account": None,
        })

    # Check stored credentials
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == MARKET_SETTINGS_KEY)
    )
    stored = result.scalar_one_or_none()
    if not stored or not stored.value:
        return APIResponse(data={"connected": False})

    try:
        data = decrypt_oauth_data(stored.value)
    except ValueError:
        return APIResponse(data={"connected": False, "error": "Stored credentials are corrupted"})

    if not data.get("access_token"):
        return APIResponse(data={"connected": False})

    # Return cached account info (fetched on connect), no external API call
    return APIResponse(data={
        "connected": True,
        "auth_type": stored.value.get("auth_type", "unknown"),
        "source": "stored",
        "connected_at": stored.value.get("connected_at"),
        "account": _get_cached_account(stored.value),
    })


async def _fetch_market_account_fresh(auth_record: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Fetch account info from Market's /auth/me using a specific token.

    Used during connect to cache the account info. Does NOT go through
    _get_market_auth_headers to avoid a DB round-trip.
    """
    try:
        token_data = decrypt_oauth_data(auth_record)
        token = token_data.get("access_token")
        if not token:
            return None
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.ACP_MARKET_URL}/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("data", data)
    except Exception as e:
        logger.warning("Failed to fetch Market account info: %s", e)
        return None


def _get_cached_account(stored_value: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Read cached account info from the stored market_auth record."""
    return stored_value.get("cached_account")


@router.post("/market/disconnect")
async def market_disconnect(
    _admin: Annotated[Admin, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> APIResponse:
    """Disconnect from ACP Market (clear stored credentials)."""
    if _is_env_connected():
        raise HTTPException(
            status_code=400,
            detail="Market is connected via environment variable. Remove ACP_MARKET_API_KEY from env to disconnect.",
        )

    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == MARKET_SETTINGS_KEY)
    )
    existing = result.scalar_one_or_none()
    if existing:
        await db.delete(existing)
        await db.commit()

    return APIResponse(data={"connected": False})


@router.get("/market/public-key")
async def market_public_key(
    _admin: Annotated[Admin, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> APIResponse:
    """Fetch the Market's Ed25519 public key for bundle signature verification.

    Fetches from Market's /signing/public-key endpoint and caches in system_settings.
    Also updates the runtime signature verifier.
    """
    CACHE_KEY = "market_public_key"

    # Try fetching from Market
    try:
        data = await _market_request("GET", "/signing/public-key")
        public_key = data.get("data", {}).get("public_key")
    except Exception as e:
        logger.warning("Failed to fetch Market public key: %s", e)
        public_key = None

    if public_key:
        # Cache in system_settings
        result = await db.execute(
            select(SystemSetting).where(SystemSetting.key == CACHE_KEY)
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.value = {"public_key": public_key, "fetched_at": datetime.now(timezone.utc).isoformat()}
        else:
            db.add(SystemSetting(
                key=CACHE_KEY,
                value={"public_key": public_key, "fetched_at": datetime.now(timezone.utc).isoformat()},
                description="Market Ed25519 public key for bundle verification",
            ))
        await db.commit()

        # Update the runtime verifier
        try:
            from app.plugins.loader import get_plugin_manager
            pm = get_plugin_manager()
            pm._verifier.set_public_key_pem(public_key)
        except Exception:
            pass  # Plugin manager may not be initialized yet

        return APIResponse(data={"public_key": public_key, "source": "market"})

    # Fallback to cached key
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == CACHE_KEY)
    )
    cached = result.scalar_one_or_none()
    if cached and cached.value:
        return APIResponse(data={
            "public_key": cached.value.get("public_key"),
            "source": "cache",
            "fetched_at": cached.value.get("fetched_at"),
        })

    return APIResponse(data={"public_key": None, "source": "none"})


# ---- Existing proxy endpoints (updated to use new auth) ----

@router.get("/market")
async def browse_market(
    _admin: Annotated[Admin, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    q: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    page: int = Query(1),
    page_size: int = Query(20),
    pricing: Optional[str] = Query(None),
) -> APIResponse:
    """Browse plugins available on ACP Market."""
    params = {
        k: v
        for k, v in {
            "q": q,
            "category": category,
            "sort": sort,
            "page": page,
            "page_size": page_size,
            "pricing": pricing,
        }.items()
        if v is not None
    }
    # Public endpoint — no auth needed
    data = await _market_request("GET", "/plugins", params=params)
    return APIResponse(data=data.get("data"))


@router.get("/market/{plugin_id}")
async def get_market_plugin(
    plugin_id: str,
    _admin: Annotated[Admin, Depends(require_admin)],
) -> APIResponse:
    """Get details of a specific plugin from ACP Market."""
    if not re.match(r'^[a-z][a-z0-9-]{2,49}$', plugin_id):
        raise HTTPException(status_code=400, detail="Invalid plugin ID")
    data = await _market_request("GET", f"/plugins/{plugin_id}")
    return APIResponse(data=data.get("data"))


@router.post("/market/check-updates")
async def check_market_updates(
    _admin: Annotated[Admin, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> APIResponse:
    """Check for updates for all installed plugins via ACP Market."""
    from app.plugins.registry import InstalledPlugin

    result = await db.execute(
        select(InstalledPlugin).where(
            InstalledPlugin.status.in_(["active", "disabled"])
        )
    )
    installed = result.scalars().all()

    body = {
        "installed": [
            {"id": p.plugin_id, "version": p.version} for p in installed
        ],
        "panel_version": "1.0.0",  # TODO: read from VERSION file
    }
    data = await _market_request("POST", "/plugins/check-updates", json=body)
    return APIResponse(data=data.get("data"))
