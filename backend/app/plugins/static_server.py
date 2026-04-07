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

        # If a previous mount is still in the routing table (e.g. after a
        # crash that bypassed deactivate), tear it down before re-mounting
        # so we don't end up with two Mount routes serving stale files.
        if plugin_id in self._mounted:
            logger.warning(
                "Plugin %s already has a static mount, unmounting first",
                plugin_id,
            )
            self.unmount(plugin_id)

        mount_path = f"/api/v1/p-static/{plugin_id}"
        mount_name = f"plugin_static_{plugin_id}"
        self._app.mount(
            mount_path,
            StaticFiles(directory=str(frontend_dir), html=True),
            name=mount_name,
        )
        self._mounted[plugin_id] = mount_path
        logger.info(
            "Mounted static files for plugin %s at %s", plugin_id, mount_path
        )

    def unmount(self, plugin_id: str) -> None:
        """Remove a plugin's static file mount from app routes.

        Filters by both the registered ``name`` and the mount ``path`` so the
        route is removed regardless of which attribute the underlying Starlette
        Mount exposes (``Mount.path`` is the configured prefix; ``Mount.name``
        is the value we set in :meth:`mount`).
        """
        if plugin_id not in self._mounted:
            logger.debug("No static mount for plugin %s, skipping", plugin_id)
            return

        mount_path = self._mounted[plugin_id]
        mount_name = f"plugin_static_{plugin_id}"
        self._app.routes[:] = [
            route
            for route in self._app.routes
            if getattr(route, "name", None) != mount_name
            and getattr(route, "path", None) != mount_path
        ]
        del self._mounted[plugin_id]
        logger.info("Unmounted static files for plugin %s", plugin_id)

    @property
    def mounted_plugins(self) -> list[str]:
        """Return list of plugin IDs with mounted static files."""
        return list(self._mounted.keys())
