from __future__ import annotations

import logging
import tempfile
from pathlib import Path
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin, require_super_admin
from app.models.admin import Admin
from app.plugins.exceptions import (
    PluginCompatError,
    PluginConflictError,
    PluginError,
    PluginManifestError,
    PluginNotFoundError,
    PluginSignatureError,
    PluginUpdateError,
)
from app.plugins.registry import InstalledPlugin
from app.plugins.schemas import (
    InstalledPluginList,
    PluginActionRequest,
    PluginConfigUpdate,
    PluginInfo,
    PluginInstallRequest,
    PluginUpdateRequest,
)
from app.schemas.common import APIResponse

logger = logging.getLogger("acp.plugins.routes")

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _plugin_to_info(plugin: InstalledPlugin) -> PluginInfo:
    """Convert an InstalledPlugin ORM instance to a PluginInfo schema."""
    return PluginInfo(
        plugin_id=plugin.plugin_id,
        name=plugin.name,
        version=plugin.version,
        previous_version=plugin.previous_version,
        status=plugin.status,
        manifest=plugin.manifest,
        config=plugin.config,
        error_count=plugin.error_count,
        last_error=plugin.last_error,
        license_key_set=plugin.license_key is not None,
        installed_at=plugin.installed_at,
        activated_at=plugin.activated_at,
        updated_at=plugin.updated_at,
    )


async def _get_download_auth_headers() -> dict[str, str]:
    """Get Market auth headers for downloading plugin bundles."""
    from app.database import async_session_factory
    from app.api.v1.market_proxy import _get_market_auth_headers

    async with async_session_factory() as session:
        return await _get_market_auth_headers(session)


async def _download_zip(url: str) -> Path:
    """Download a plugin zip from a market URL to a temp file.

    Also captures the X-Bundle-Signature header and writes a .sig file
    alongside the zip for signature verification.
    """
    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    try:
        headers = await _get_download_auth_headers()
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            tmp.write(resp.content)
            tmp.flush()

        # Write signature file if Market provided one
        sig_b64 = resp.headers.get("X-Bundle-Signature")
        if sig_b64:
            import base64
            sig_path = Path(tmp.name).with_suffix(".sig")
            sig_path.write_bytes(base64.b64decode(sig_b64))
            logger.info("Bundle signature saved to %s", sig_path)

    except httpx.HTTPStatusError as exc:
        Path(tmp.name).unlink(missing_ok=True)
        if exc.response.status_code in (401, 403):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Market authentication required. Please connect to ACP Market in Settings > Market before installing plugins.",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Market returned {exc.response.status_code}: {exc.response.text[:200]}",
        ) from exc
    except httpx.HTTPError as exc:
        Path(tmp.name).unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to download plugin bundle: {exc}",
        ) from exc
    finally:
        tmp.close()
    return Path(tmp.name)


def _map_plugin_error(exc: PluginError) -> HTTPException:
    """Map a PluginError subclass to an appropriate HTTP exception."""
    if isinstance(exc, PluginNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, PluginSignatureError):
        return HTTPException(status_code=422, detail=str(exc))
    if isinstance(exc, PluginManifestError):
        return HTTPException(status_code=422, detail=str(exc))
    if isinstance(exc, PluginCompatError):
        return HTTPException(status_code=409, detail=str(exc))
    if isinstance(exc, PluginConflictError):
        return HTTPException(status_code=409, detail=str(exc))
    if isinstance(exc, PluginUpdateError):
        return HTTPException(status_code=500, detail=str(exc))
    return HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=APIResponse)
async def list_plugins(
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[Admin, Depends(require_admin)],
) -> APIResponse:
    """List all installed plugins."""
    result = await db.execute(select(InstalledPlugin).order_by(InstalledPlugin.plugin_id))
    plugins = result.scalars().all()
    info_list = [_plugin_to_info(p) for p in plugins]
    return APIResponse(
        data=InstalledPluginList(plugins=info_list, total=len(info_list)).model_dump(),
    )


@router.get("/{plugin_id}", response_model=APIResponse)
async def get_plugin(
    plugin_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[Admin, Depends(require_admin)],
) -> APIResponse:
    """Get detail for a single installed plugin."""
    result = await db.execute(
        select(InstalledPlugin).where(InstalledPlugin.plugin_id == plugin_id)
    )
    plugin = result.scalar_one_or_none()
    if plugin is None:
        raise HTTPException(status_code=404, detail=f"Plugin '{plugin_id}' not found")
    return APIResponse(data=_plugin_to_info(plugin).model_dump())


@router.post("/install", response_model=APIResponse)
async def install_plugin(
    body: PluginInstallRequest,
    _admin: Annotated[Admin, Depends(require_super_admin)],
) -> APIResponse:
    """Install a plugin from Market (optionally downloading the bundle)."""
    from app.plugins.loader import get_plugin_manager

    pm = get_plugin_manager()

    zip_path: Path | None = None
    try:
        # Build download URL from Market settings if not explicitly provided
        download_url = body.market_url
        if not download_url:
            from app.config import settings as app_settings
            download_url = (
                f"{app_settings.ACP_MARKET_URL}/plugins/{body.plugin_id}"
                f"/versions/{body.version}/download"
            )
        zip_path = await _download_zip(download_url)

        # Install
        info = await pm.install(
            plugin_id=body.plugin_id,
            version=body.version,
            zip_path=zip_path,
            license_key=body.license_key,
        )

        # Auto-activate after install
        info = await pm.activate(body.plugin_id)
        return APIResponse(data=info.model_dump(), message="Plugin installed and activated")

    except PluginError as exc:
        raise _map_plugin_error(exc) from exc
    finally:
        if zip_path and zip_path.exists():
            zip_path.unlink(missing_ok=True)
            # Also clean up the signature file if it exists
            sig_path = zip_path.with_suffix(".sig")
            if sig_path.exists():
                sig_path.unlink(missing_ok=True)


@router.post("/{plugin_id}/action", response_model=APIResponse)
async def plugin_action(
    plugin_id: str,
    body: PluginActionRequest,
    _admin: Annotated[Admin, Depends(require_super_admin)],
) -> APIResponse:
    """Perform a lifecycle action on a plugin."""
    from app.plugins.loader import get_plugin_manager

    pm = get_plugin_manager()

    try:
        if body.action == "activate":
            info = await pm.activate(plugin_id)
            return APIResponse(data=info.model_dump(), message="Plugin activated")

        elif body.action == "deactivate":
            await pm.deactivate(plugin_id)
            return APIResponse(message="Plugin deactivated")

        elif body.action == "uninstall":
            await pm.uninstall(plugin_id, drop_tables=body.drop_tables)
            return APIResponse(message="Plugin uninstalled")

        elif body.action == "rollback":
            info = await pm.rollback(plugin_id)
            return APIResponse(data=info.model_dump(), message="Plugin rolled back")

        else:
            raise HTTPException(status_code=400, detail=f"Unknown action: {body.action}")

    except PluginError as exc:
        raise _map_plugin_error(exc) from exc


@router.post("/{plugin_id}/update", response_model=APIResponse)
async def update_plugin(
    plugin_id: str,
    body: PluginUpdateRequest,
    _admin: Annotated[Admin, Depends(require_super_admin)],
) -> APIResponse:
    """Update a plugin to a new version."""
    from app.plugins.loader import get_plugin_manager

    pm = get_plugin_manager()

    zip_path: Path | None = None
    try:
        if body.market_url:
            zip_path = await _download_zip(body.market_url)
        else:
            raise HTTPException(
                status_code=400,
                detail="market_url is required for remote update",
            )

        info = await pm.update(plugin_id, new_version=body.version, zip_path=zip_path)
        return APIResponse(data=info.model_dump(), message="Plugin updated")

    except PluginError as exc:
        raise _map_plugin_error(exc) from exc
    finally:
        if zip_path and zip_path.exists():
            zip_path.unlink(missing_ok=True)
            sig_path = zip_path.with_suffix(".sig")
            if sig_path.exists():
                sig_path.unlink(missing_ok=True)


@router.patch("/{plugin_id}/config", response_model=APIResponse)
async def update_plugin_config(
    plugin_id: str,
    body: PluginConfigUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[Admin, Depends(require_super_admin)],
) -> APIResponse:
    """Update plugin configuration (merge with existing)."""
    result = await db.execute(
        select(InstalledPlugin).where(InstalledPlugin.plugin_id == plugin_id)
    )
    plugin = result.scalar_one_or_none()
    if plugin is None:
        raise HTTPException(status_code=404, detail=f"Plugin '{plugin_id}' not found")

    # Merge new config into existing
    merged = {**plugin.config, **body.config}
    plugin.config = merged
    await db.flush()

    return APIResponse(
        data=_plugin_to_info(plugin).model_dump(),
        message="Plugin config updated",
    )
