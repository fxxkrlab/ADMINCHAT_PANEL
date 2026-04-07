from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from fastapi import APIRouter

if TYPE_CHECKING:
    from fastapi import FastAPI

logger = logging.getLogger("acp.plugins.router_mount")

PLUGIN_API_PREFIX = "/api/v1/p"


class DynamicRouterMount:
    """Dynamically mount and unmount FastAPI routers for plugins."""

    def __init__(self) -> None:
        self._mounted: dict[str, APIRouter] = {}

    def mount(self, app: FastAPI, plugin_id: str, router: APIRouter) -> None:
        """Mount a plugin's API router under the plugin API prefix."""
        if plugin_id in self._mounted:
            logger.warning(
                "Plugin %s already has a mounted router, unmounting first",
                plugin_id,
            )
            self.unmount(app, plugin_id)

        prefix = f"{PLUGIN_API_PREFIX}/{plugin_id}"
        app.include_router(router, prefix=prefix, tags=[f"plugin:{plugin_id}"])
        # Invalidate the cached OpenAPI schema so the new routes show up in
        # /docs and /openapi.json without restarting the process.
        app.openapi_schema = None
        self._mounted[plugin_id] = router
        logger.info("Mounted API router for plugin %s at %s", plugin_id, prefix)

    def unmount(self, app: FastAPI, plugin_id: str) -> None:
        """Unmount a plugin's API router by filtering it from app routes."""
        if plugin_id not in self._mounted:
            logger.warning("No mounted router for plugin %s", plugin_id)
            return

        prefix = f"{PLUGIN_API_PREFIX}/{plugin_id}"
        # Match using ``path`` for APIRoute and ``path_format`` as a fallback
        # for parametrised routes — both attributes are present on
        # starlette.routing.Route subclasses but the latter is the canonical
        # template form. We strip routes whose template starts with our prefix.
        def _belongs_to_plugin(route: object) -> bool:
            for attr in ("path", "path_format"):
                value = getattr(route, attr, None)
                if isinstance(value, str) and value.startswith(prefix):
                    return True
            return False

        app.router.routes = [
            route for route in app.router.routes if not _belongs_to_plugin(route)
        ]
        # Invalidate cached OpenAPI schema so /docs reflects the removal.
        app.openapi_schema = None
        del self._mounted[plugin_id]
        logger.info("Unmounted API router for plugin %s", plugin_id)

    @property
    def mounted_plugins(self) -> list[str]:
        """Return list of plugin IDs with mounted API routers."""
        return list(self._mounted.keys())
