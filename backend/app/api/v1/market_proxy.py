"""Proxy endpoints for ACP Market API calls."""
from __future__ import annotations

import logging
import re
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.api.deps import get_db, require_admin
from app.models.admin import Admin
from app.schemas.common import APIResponse
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

MARKET_API_URL = settings.ACP_MARKET_URL
MARKET_API_KEY = settings.ACP_MARKET_API_KEY


async def _market_request(method: str, path: str, **kwargs) -> dict:
    """Forward a request to Market API."""
    headers = {}
    if MARKET_API_KEY:
        headers["X-ACP-API-Key"] = MARKET_API_KEY

    async with httpx.AsyncClient(timeout=30.0) as client:
        url = f"{MARKET_API_URL}{path}"
        resp = await client.request(method, url, headers=headers, **kwargs)
        resp.raise_for_status()
        return resp.json()


@router.get("/market")
async def browse_market(
    _admin: Annotated[Admin, Depends(require_admin)],
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
    from sqlalchemy import select

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
