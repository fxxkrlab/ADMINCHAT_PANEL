from __future__ import annotations

import logging
from pathlib import Path
from typing import TYPE_CHECKING

from starlette.staticfiles import StaticFiles

if TYPE_CHECKING:
    from fastapi import FastAPI

logger = logging.getLogger("acp.plugins.static_server")


class PluginStaticServer:
    """Serve static frontend assets for plugins."""

    def __init__(self, app: FastAPI) -> None:
        self._app = app
        self._mounted: dict[str, str] = {}  # plugin_id -> mount_path

    def mount(self, plugin_id: str, plugin_path: Path) -> None:
        """Mount a plugin's frontend/ directory as static files."""
        frontend_dir = plugin_path / "frontend"
        if not frontend_dir.is_dir():
            logger.warning(
                "Plugin %s has no frontend/ directory at %s, skipping static mount",
                plugin_id,
                frontend_dir,
            )
            return

        mount_path = f"/api/v1/plugins/{plugin_id}/static"
        self._app.mount(
            mount_path,
            StaticFiles(directory=str(frontend_dir), html=True),
            name=f"plugin_static_{plugin_id}",
        )
        self._mounted[plugin_id] = mount_path
        logger.info(
            "Mounted static files for plugin %s at %s", plugin_id, mount_path
        )

    def unmount(self, plugin_id: str) -> None:
        """Remove a plugin's static file mount from app routes."""
        if plugin_id not in self._mounted:
            logger.warning("No static mount for plugin %s", plugin_id)
            return

        mount_path = self._mounted[plugin_id]
        self._app.routes[:] = [
            route
            for route in self._app.routes
            if not (hasattr(route, "path") and getattr(route, "path", None) == mount_path)
        ]
        del self._mounted[plugin_id]
        logger.info("Unmounted static files for plugin %s", plugin_id)

    @property
    def mounted_plugins(self) -> list[str]:
        """Return list of plugin IDs with mounted static files."""
        return list(self._mounted.keys())
