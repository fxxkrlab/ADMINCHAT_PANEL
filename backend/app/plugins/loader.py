from __future__ import annotations

import importlib
import importlib.util
import json
import logging
import shutil
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from types import ModuleType
from typing import Any, Optional

from fastapi import FastAPI
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.plugins.config_store import PluginConfigStore
from app.plugins.core_sdk import CoreSDKBridge
from app.plugins.event_bus import PluginEventBus
from app.plugins.exceptions import (
    PluginCompatError,
    PluginConflictError,
    PluginError,
    PluginImportError,
    PluginManifestError,
    PluginNotFoundError,
    PluginSetupError,
    PluginUpdateError,
)
from app.plugins.handler_mount import HotSwappableRouter
from app.plugins.health_monitor import PluginHealthMonitor
from app.plugins.registry import InstalledPlugin
from app.plugins.router_mount import DynamicRouterMount
from app.plugins.schemas import PluginInfo
from app.plugins.secret_store import PluginSecretStore
from app.plugins.signature_verifier import BundleSignatureVerifier
from app.plugins.static_server import PluginStaticServer
from app.plugins.utils import extract_plugin_zip

logger = logging.getLogger("acp.plugins.loader")


# ---------------------------------------------------------------------------
# Internal dataclasses
# ---------------------------------------------------------------------------

@dataclass
class _LoadedPlugin:
    """In-memory representation of a loaded and active plugin."""

    plugin_id: str
    version: str
    manifest: dict[str, Any]
    module: ModuleType
    plugin_path: Path
    # Names of all sys.modules entries that were created while importing this
    # plugin. Used by deactivate() to fully purge the plugin's import footprint
    # so a subsequent activate() picks up freshly written files instead of stale
    # cached modules. Without this, ``from backend.routes import router`` keeps
    # returning the previous version's router after an in-place update.
    imported_modules: set[str] = field(default_factory=set)


@dataclass
class PluginContext:
    """Context object passed to plugin setup() and available during runtime."""

    plugin_id: str
    version: str
    manifest: dict[str, Any]
    plugin_path: Path
    sdk: CoreSDKBridge
    secrets: PluginSecretStore
    config: PluginConfigStore
    event_bus: PluginEventBus
    logger: logging.Logger


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_plugin_manager: Optional[PluginManager] = None


def get_plugin_manager() -> PluginManager:
    """Return the singleton PluginManager instance."""
    if _plugin_manager is None:
        raise RuntimeError(
            "PluginManager not initialized — call PluginManager.startup() first"
        )
    return _plugin_manager


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_plugin_data_dir() -> Path:
    """Return the root directory where plugin bundles are stored."""
    data_dir = Path("/data/plugins")
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def _parse_manifest(plugin_path: Path) -> dict[str, Any]:
    """Parse and validate a plugin's manifest.json."""
    manifest_file = plugin_path / "manifest.json"
    if not manifest_file.exists():
        raise PluginManifestError(
            f"manifest.json not found in {plugin_path}"
        )

    try:
        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        raise PluginManifestError(
            f"Failed to parse manifest.json: {exc}"
        ) from exc

    # Validate required fields
    required = ("id", "name", "version", "entry_point")
    missing = [f for f in required if f not in manifest]
    if missing:
        raise PluginManifestError(
            f"manifest.json missing required fields: {', '.join(missing)}"
        )

    return manifest


def _extract_plugin_zip(zip_path: Path, target_dir: Path) -> Path:
    """Extract a plugin zip bundle to the target directory.

    Delegates to utils.extract_plugin_zip which includes path traversal
    protection.
    """
    return extract_plugin_zip(zip_path, target_dir)


# ---------------------------------------------------------------------------
# sys.modules hygiene
# ---------------------------------------------------------------------------
#
# Plugins are loaded with the plugin directory appended to ``sys.path`` so that
# intra-plugin imports like ``from backend.routes import router`` work without
# requiring authors to use a per-plugin namespace prefix. This is convenient
# but means submodules end up in ``sys.modules`` under unqualified, top-level
# names (``backend``, ``backend.routes``, ``backend.handlers`` …).
#
# That creates two failure modes the helpers below address:
#
# 1. **Stale code on reactivate / update.** When a plugin is updated in place
#    and reactivated, ``importlib`` re-executes the entry point file but any
#    ``from backend.routes import router`` it runs hits Python's module cache
#    and returns the *old* module object built from the previous version's
#    file. The newly written ``backend/routes.py`` on disk is never re-read.
#
# 2. **Cross-plugin namespace collisions.** Two plugins that both ship a
#    top-level ``backend`` package will silently shadow each other — whichever
#    activated first wins, and the second plugin's submodules are simply never
#    loaded.
#
# The fix is to (a) snapshot what each plugin imports so we can purge it
# precisely on deactivate, (b) clear conflicting cached entries before each
# activate, and (c) use a path-based fallback to catch lazily-imported modules
# (e.g. inside ``teardown()``).


def _scan_top_level_names(plugin_path: Path) -> set[str]:
    """Return the set of top-level module/package names a plugin exposes.

    Looks at the immediate children of ``plugin_path``: subdirectories with
    an ``__init__.py`` are packages; ``.py`` files are modules. The result
    drives proactive cache cleanup so a plugin's first import doesn't pick up
    a same-named package left behind by another plugin.
    """
    names: set[str] = set()
    if not plugin_path.is_dir():
        return names
    try:
        for child in plugin_path.iterdir():
            if child.is_dir() and (child / "__init__.py").is_file():
                names.add(child.name)
            elif child.is_file() and child.suffix == ".py" and child.stem != "__init__":
                names.add(child.stem)
    except OSError:
        logger.debug("Could not scan top-level names for %s", plugin_path)
    return names


def _pop_modules_under_path(plugin_path: Path) -> set[str]:
    """Remove every ``sys.modules`` entry whose ``__file__`` lives under ``plugin_path``.

    Returns the set of module names that were removed. Best-effort — modules
    without a resolvable ``__file__`` (built-ins, namespace packages, frozen
    modules) are skipped silently. Never raises.
    """
    try:
        plugin_str = str(plugin_path.resolve())
    except OSError:
        plugin_str = str(plugin_path)

    removed: set[str] = set()
    for mod_name, mod in list(sys.modules.items()):
        if mod is None:
            continue
        mod_file = getattr(mod, "__file__", None)
        if not mod_file:
            continue
        try:
            mod_file_resolved = str(Path(mod_file).resolve())
        except (OSError, ValueError):
            continue
        if mod_file_resolved.startswith(plugin_str):
            removed.add(mod_name)

    for name in removed:
        sys.modules.pop(name, None)
    return removed


def _pop_modules_by_names(names: set[str]) -> set[str]:
    """Remove ``sys.modules`` entries equal to or descended from any name in ``names``.

    Used to evict ``backend`` AND ``backend.routes``, ``backend.services.tmdb``,
    etc. in one shot when only the top-level package name is known. Returns
    the set of removed module names.
    """
    if not names:
        return set()
    removed: set[str] = set()
    prefixes = tuple(f"{name}." for name in names)
    for mod_name in list(sys.modules.keys()):
        if mod_name in names or mod_name.startswith(prefixes):
            removed.add(mod_name)
    for name in removed:
        sys.modules.pop(name, None)
    return removed


def _read_panel_version() -> str:
    """Read the current Panel version from the VERSION file."""
    version_file = Path(__file__).resolve().parents[3] / "VERSION"
    try:
        return version_file.read_text().strip()
    except OSError:
        logger.warning("Could not read VERSION file at %s", version_file)
        return "0.0.0"


def _check_version_compat(
    manifest: dict[str, Any], panel_version: str
) -> None:
    """Check that the plugin is compatible with the current Panel version."""
    min_version = manifest.get("min_panel_version")
    if min_version is None:
        return

    from packaging.version import InvalidVersion, Version

    try:
        required = Version(min_version)
        current = Version(panel_version)
    except InvalidVersion:
        logger.warning(
            "Cannot parse version strings: min=%s current=%s",
            min_version,
            panel_version,
        )
        return

    if current < required:
        raise PluginCompatError(
            f"Plugin requires Panel >= {min_version}, "
            f"current version is {panel_version}",
            plugin_id=manifest.get("id"),
        )


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


async def _publish_plugin_event(plugin_id: str, action: str) -> None:
    """Publish a plugin_changed event via Redis pub/sub.

    Best-effort — failures are logged but never raised.
    """
    try:
        from app.services.redis import get_redis

        redis = await get_redis()
        payload = json.dumps({
            "event": "plugin_changed",
            "data": {
                "plugin_id": plugin_id,
                "action": action,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        })
        await redis.publish("adminchat:plugins", payload)
        logger.debug("Published plugin_changed event: %s/%s", plugin_id, action)
    except Exception:
        logger.warning(
            "Failed to publish plugin_changed event for %s/%s",
            plugin_id,
            action,
            exc_info=True,
        )


# ---------------------------------------------------------------------------
# PluginManager
# ---------------------------------------------------------------------------

class PluginManager:
    """Main plugin orchestrator.

    Manages the full lifecycle: install, activate, deactivate, update,
    rollback, and uninstall of plugins.
    """

    def __init__(self, app: FastAPI) -> None:
        self._app = app
        self._loaded: dict[str, _LoadedPlugin] = {}
        self._contexts: dict[str, PluginContext] = {}

        # Sub-systems
        self._router_mount = DynamicRouterMount()
        self._handler_mount = HotSwappableRouter()
        self._static_server = PluginStaticServer(app)
        self._verifier = BundleSignatureVerifier()
        self._health = PluginHealthMonitor()
        self._event_bus = PluginEventBus()

        # Give health monitor a reference for auto-disable
        self._health.set_plugin_manager(self)

    def ensure_app(self, app: FastAPI) -> None:
        """Ensure _app is the real FastAPI instance (not a module ref).

        Called from route handlers with request.app to fix the reference
        if it got corrupted during module imports.
        """
        from fastapi import FastAPI as _FastAPI
        if not isinstance(self._app, _FastAPI):
            logger.warning(
                "PluginManager._app was %s, fixing to FastAPI instance",
                type(self._app).__name__,
            )
            self._app = app
            self._static_server._app = app

    async def _load_cached_public_key(self) -> None:
        """Load the Market public key from system_settings (if cached)."""
        if self._verifier.has_key:
            return  # Already loaded from env var

        try:
            from app.models.settings import SystemSetting

            async with async_session_factory() as session:
                result = await session.execute(
                    select(SystemSetting).where(
                        SystemSetting.key == "market_public_key"
                    )
                )
                cached = result.scalar_one_or_none()
                if cached and cached.value and cached.value.get("public_key"):
                    self._verifier.set_public_key_pem(cached.value["public_key"])
                    logger.info("Market public key loaded from system_settings cache")
        except Exception:
            logger.debug("Could not load cached Market public key", exc_info=True)

    # ------------------------------------------------------------------
    # Lifecycle: startup / shutdown
    # ------------------------------------------------------------------

    async def startup(self) -> dict[str, str]:
        """Load and activate all plugins marked as 'active' in the DB.

        Sets the global singleton. Returns a dict of
        ``{plugin_id: "ok" | error_message}``.
        """
        global _plugin_manager
        _plugin_manager = self

        # Fix _app reference if it became a module during import
        from fastapi import FastAPI as _FastAPI
        if not isinstance(self._app, _FastAPI):
            logger.warning("Fixing _app at startup (was %s)", type(self._app).__name__)
            from app.main import app as real_app
            self._app = real_app
            self._static_server._app = real_app

        # Try to load Market public key from system_settings cache
        await self._load_cached_public_key()

        results: dict[str, str] = {}

        async with async_session_factory() as session:
            rows = await session.execute(
                select(InstalledPlugin).where(InstalledPlugin.status == "active")
            )
            active_plugins = rows.scalars().all()

        if not active_plugins:
            logger.info("No active plugins to load at startup")
            return results

        logger.info("Loading %d active plugin(s)...", len(active_plugins))

        for record in active_plugins:
            try:
                await self.activate(record.plugin_id)
                results[record.plugin_id] = "ok"
            except Exception as exc:
                error_msg = f"{type(exc).__name__}: {exc}"
                results[record.plugin_id] = error_msg
                logger.error(
                    "Failed to activate plugin %s at startup: %s",
                    record.plugin_id,
                    error_msg,
                )
                await self._health.record_error(record.plugin_id, error_msg)

        loaded_count = sum(1 for v in results.values() if v == "ok")
        logger.info(
            "Plugin startup complete: %d/%d loaded successfully",
            loaded_count,
            len(results),
        )
        return results

    async def shutdown(self) -> None:
        """Gracefully tear down all loaded plugins (in reverse load order)."""
        plugin_ids = list(reversed(list(self._loaded.keys())))

        for plugin_id in plugin_ids:
            loaded = self._loaded.get(plugin_id)
            try:
                if loaded and hasattr(loaded.module, "teardown"):
                    await loaded.module.teardown()
                    logger.info("Plugin %s teardown complete", plugin_id)
            except Exception:
                logger.exception("Error tearing down plugin %s", plugin_id)

            # Fully purge the plugin's import footprint so a hot reload of
            # the host process picks up fresh code.
            mod_name = f"plg_{plugin_id}"
            if loaded is not None:
                for name in loaded.imported_modules:
                    sys.modules.pop(name, None)
                _pop_modules_under_path(loaded.plugin_path)
                plugin_path_str = str(loaded.plugin_path)
                if plugin_path_str in sys.path:
                    sys.path.remove(plugin_path_str)
            sys.modules.pop(mod_name, None)

        self._loaded.clear()
        self._contexts.clear()
        logger.info("All plugins shut down")

    # ------------------------------------------------------------------
    # Install
    # ------------------------------------------------------------------

    async def install(
        self,
        plugin_id: str,
        version: str,
        zip_path: Path,
        license_key: str | None = None,
    ) -> PluginInfo:
        """Install a plugin from a zip bundle.

        1. Verify signature (if configured)
        2. Extract to data_dir / plugin_id / version /
        3. Parse manifest.json
        4. Validate compatibility
        5. Check for conflicts
        6. Insert into installed_plugins table
        """
        logger.info("Installing plugin %s v%s from %s", plugin_id, version, zip_path)

        # 1. Verify signature
        sig_path = zip_path.with_suffix(".sig")
        if sig_path.exists():
            self._verifier.verify(zip_path, sig_path)

        # 2. Extract
        data_dir = _get_plugin_data_dir()
        plugin_dir = data_dir / plugin_id / version
        if plugin_dir.exists():
            shutil.rmtree(plugin_dir)

        _extract_plugin_zip(zip_path, plugin_dir)

        # 3. Parse manifest
        manifest = _parse_manifest(plugin_dir)

        # 4. Version compatibility
        panel_version = _read_panel_version()
        _check_version_compat(manifest, panel_version)

        # 5. Conflict check
        async with async_session_factory() as session:
            existing = await session.execute(
                select(InstalledPlugin).where(
                    InstalledPlugin.plugin_id == plugin_id
                )
            )
            if existing.scalar_one_or_none() is not None:
                raise PluginConflictError(
                    f"Plugin '{plugin_id}' is already installed",
                    plugin_id=plugin_id,
                )

        # 6. Insert DB record
        async with async_session_factory() as session:
            record = InstalledPlugin(
                plugin_id=plugin_id,
                name=manifest.get("name", plugin_id),
                version=version,
                status="installed",
                manifest=manifest,
                config=manifest.get("default_config", {}),
                license_key=license_key,
            )
            session.add(record)
            await session.commit()
            await session.refresh(record)
            info = _plugin_to_info(record)

        await _publish_plugin_event(plugin_id, "installed")
        logger.info("Plugin %s v%s installed successfully", plugin_id, version)
        return info

    # ------------------------------------------------------------------
    # Activate
    # ------------------------------------------------------------------

    async def activate(self, plugin_id: str) -> PluginInfo:
        """Activate an installed plugin.

        1. Read record from DB
        2. Dynamic import via importlib
        3. Run migrations
        4. Mount API router / bot handler / static files
        5. Create PluginContext and call setup()
        6. Update DB status to 'active'
        """
        logger.info("Activating plugin %s", plugin_id)

        # 1. Read DB record
        async with async_session_factory() as session:
            result = await session.execute(
                select(InstalledPlugin).where(
                    InstalledPlugin.plugin_id == plugin_id
                )
            )
            record = result.scalar_one_or_none()
            if record is None:
                raise PluginNotFoundError(
                    f"Plugin '{plugin_id}' not found",
                    plugin_id=plugin_id,
                )

            version = record.version
            manifest = record.manifest

        # 2. Build plugin path and import
        data_dir = _get_plugin_data_dir()
        plugin_path = data_dir / plugin_id / version

        if not plugin_path.exists():
            raise PluginImportError(
                f"Plugin directory not found: {plugin_path}",
                plugin_id=plugin_id,
            )

        entry_point = manifest.get("entry_point", "__init__.py")
        entry_file = plugin_path / entry_point

        if not entry_file.exists():
            raise PluginImportError(
                f"Entry point not found: {entry_file}",
                plugin_id=plugin_id,
            )

        mod_name = f"plg_{plugin_id}"
        plugin_path_str = str(plugin_path)
        sys_path_was_appended = False

        # Hygiene: clear any cached modules from a previous load of this plugin
        # OR from a different plugin that happens to expose the same top-level
        # package name. Without this, ``from backend.routes import router``
        # below would resolve to a stale module object cached by Python's
        # import system. See the docstring on _pop_modules_by_names above.
        top_level_names = _scan_top_level_names(plugin_path)
        cache_evict_targets = top_level_names | {mod_name}
        evicted_by_name = _pop_modules_by_names(cache_evict_targets)
        evicted_by_path = _pop_modules_under_path(plugin_path)
        if evicted_by_name or evicted_by_path:
            logger.debug(
                "Evicted %d stale sys.modules entries before loading %s "
                "(by-name=%d, by-path=%d)",
                len(evicted_by_name | evicted_by_path),
                plugin_id,
                len(evicted_by_name),
                len(evicted_by_path),
            )

        # Snapshot sys.modules so we can compute exactly which entries this
        # plugin's import populates. The diff is stored on _LoadedPlugin and
        # used by deactivate() to purge them precisely.
        modules_before = set(sys.modules.keys())

        try:
            # Add plugin root to sys.path so intra-plugin imports work
            # e.g. "from backend.routes import router" inside backend/plugin.py
            # Append (not insert) to avoid shadowing the host app's 'app' package
            if plugin_path_str not in sys.path:
                sys.path.append(plugin_path_str)
                sys_path_was_appended = True

            spec = importlib.util.spec_from_file_location(
                mod_name, str(entry_file)
            )
            if spec is None or spec.loader is None:
                raise PluginImportError(
                    f"Could not create module spec for {entry_file}",
                    plugin_id=plugin_id,
                )
            module = importlib.util.module_from_spec(spec)
            sys.modules[mod_name] = module
            spec.loader.exec_module(module)
        except PluginImportError:
            # Roll back sys.path / sys.modules so a retry starts clean.
            if sys_path_was_appended and plugin_path_str in sys.path:
                sys.path.remove(plugin_path_str)
            sys.modules.pop(mod_name, None)
            _pop_modules_by_names(set(sys.modules.keys()) - modules_before)
            raise
        except Exception as exc:
            if sys_path_was_appended and plugin_path_str in sys.path:
                sys.path.remove(plugin_path_str)
            sys.modules.pop(mod_name, None)
            _pop_modules_by_names(set(sys.modules.keys()) - modules_before)
            raise PluginImportError(
                f"Failed to import plugin '{plugin_id}': {exc}",
                plugin_id=plugin_id,
            ) from exc

        imported_modules = set(sys.modules.keys()) - modules_before
        imported_modules.add(mod_name)

        # 3. Run migrations (best-effort — module may not exist yet)
        try:
            from app.plugins.migration_runner import PluginMigrationRunner

            runner = PluginMigrationRunner(plugin_id, plugin_path)
            await runner.upgrade()
        except ImportError:
            logger.debug(
                "migration_runner not available, skipping migrations for %s",
                plugin_id,
            )
        except Exception:
            logger.exception(
                "Migration failed for plugin %s", plugin_id
            )

        # Use the verified FastAPI app reference
        _real_app = self._app

        # ── 4. Mount API router / bot handler / static files (transactional) ──
        # Track which subsystems were successfully mounted so we can roll them
        # back as a unit if any later step (mount, setup, DB commit) fails.
        # Without this, a setup() exception would leave a half-mounted plugin
        # whose routes are still served and can't be cleanly removed.
        api_mounted = False
        bot_mounted = False
        static_mounted = False
        ctx: PluginContext | None = None

        try:
            if hasattr(module, "get_router"):
                api_router = module.get_router()
                self._router_mount.mount(_real_app, plugin_id, api_router)
                api_mounted = True

            if hasattr(module, "get_bot_router"):
                bot_router = module.get_bot_router()
                priority = manifest.get("bot_handler_priority", 50)
                self._handler_mount.add(plugin_id, bot_router, priority)
                bot_mounted = True

            self._static_server._app = _real_app  # ensure correct app ref
            self._static_server.mount(plugin_id, plugin_path)
            static_mounted = plugin_id in self._static_server.mounted_plugins

            # 5. Create PluginContext and call setup()
            ctx = PluginContext(
                plugin_id=plugin_id,
                version=version,
                manifest=manifest,
                plugin_path=plugin_path,
                sdk=CoreSDKBridge(plugin_id, manifest, async_session_factory),
                secrets=PluginSecretStore(plugin_id),
                config=PluginConfigStore(plugin_id),
                event_bus=self._event_bus,
                logger=logging.getLogger(f"acp.plugin.{plugin_id}"),
            )

            if hasattr(module, "setup"):
                await module.setup(ctx)

        except Exception as exc:
            # Roll back any partial mounts so the next activation starts clean.
            if api_mounted:
                try:
                    self._router_mount.unmount(_real_app, plugin_id)
                except Exception:
                    logger.exception(
                        "Cleanup: failed to unmount API router for %s", plugin_id
                    )
            if bot_mounted:
                try:
                    self._handler_mount.remove(plugin_id)
                except Exception:
                    logger.exception(
                        "Cleanup: failed to remove bot router for %s", plugin_id
                    )
            if static_mounted:
                try:
                    self._static_server.unmount(plugin_id)
                except Exception:
                    logger.exception(
                        "Cleanup: failed to unmount static for %s", plugin_id
                    )
            self._event_bus.unsubscribe_all(plugin_id)
            for name in imported_modules:
                sys.modules.pop(name, None)
            _pop_modules_under_path(plugin_path)
            if sys_path_was_appended and plugin_path_str in sys.path:
                sys.path.remove(plugin_path_str)

            if isinstance(exc, PluginSetupError):
                raise
            raise PluginSetupError(
                f"setup() failed for plugin '{plugin_id}': {exc}",
                plugin_id=plugin_id,
            ) from exc

        # Commit context only after setup() succeeded.
        self._contexts[plugin_id] = ctx

        # 6. Update DB status BEFORE adding to _loaded dict
        #    If the DB commit fails, the plugin won't be in _loaded.
        async with async_session_factory() as session:
            await session.execute(
                update(InstalledPlugin)
                .where(InstalledPlugin.plugin_id == plugin_id)
                .values(
                    status="active",
                    activated_at=datetime.utcnow(),
                    error_count=0,
                    last_error=None,
                )
            )
            await session.commit()

            # Re-read for response
            result = await session.execute(
                select(InstalledPlugin).where(
                    InstalledPlugin.plugin_id == plugin_id
                )
            )
            record = result.scalar_one()
            info = _plugin_to_info(record)

        # Store loaded plugin (after successful DB commit)
        self._loaded[plugin_id] = _LoadedPlugin(
            plugin_id=plugin_id,
            version=version,
            manifest=manifest,
            module=module,
            plugin_path=plugin_path,
            imported_modules=imported_modules,
        )

        await _publish_plugin_event(plugin_id, "activated")
        logger.info("Plugin %s v%s activated", plugin_id, version)
        return info

    # ------------------------------------------------------------------
    # Deactivate
    # ------------------------------------------------------------------

    async def deactivate(self, plugin_id: str) -> None:
        """Deactivate an active plugin.

        1. Call module.teardown() if it exists
        2. Remove API routes, bot handler, static files
        3. Unsubscribe events
        4. Clean up sys.modules
        5. Update DB status to 'disabled'
        """
        logger.info("Deactivating plugin %s", plugin_id)

        loaded = self._loaded.get(plugin_id)

        # 1. Teardown
        if loaded and hasattr(loaded.module, "teardown"):
            try:
                await loaded.module.teardown()
            except Exception:
                logger.exception(
                    "Error in teardown for plugin %s", plugin_id
                )

        # 2. Remove routes, handlers, static
        self._router_mount.unmount(self._app, plugin_id)
        self._handler_mount.remove(plugin_id)
        self._static_server.unmount(plugin_id)

        # 3. Unsubscribe events
        self._event_bus.unsubscribe_all(plugin_id)

        # 4. Clean up modules and sys.path
        #
        # Pop ALL submodules the plugin populated in sys.modules — not just
        # the ``plg_{id}`` entry point. This is the fix for the long-standing
        # "reactivate doesn't pick up new code" bug: without it, modules like
        # ``backend.routes`` linger in the cache and the next ``from
        # backend.routes import router`` returns the *previous* version's
        # router object even though the file on disk has been replaced.
        mod_name = f"plg_{plugin_id}"
        if loaded is not None:
            for name in loaded.imported_modules:
                sys.modules.pop(name, None)
            # Belt-and-suspenders: also evict anything whose ``__file__``
            # lives under the plugin directory. Catches modules imported
            # *after* activate() — typically inside teardown() handlers
            # (e.g. ``from backend.services.tmdb import close_tmdb_client``).
            _pop_modules_under_path(loaded.plugin_path)
        sys.modules.pop(mod_name, None)

        self._loaded.pop(plugin_id, None)
        self._contexts.pop(plugin_id, None)

        # Remove plugin path from sys.path
        if loaded:
            plugin_path_str = str(loaded.plugin_path)
            if plugin_path_str in sys.path:
                sys.path.remove(plugin_path_str)

        # 5. Update DB status
        async with async_session_factory() as session:
            await session.execute(
                update(InstalledPlugin)
                .where(InstalledPlugin.plugin_id == plugin_id)
                .values(status="disabled")
            )
            await session.commit()

        await _publish_plugin_event(plugin_id, "deactivated")
        logger.info("Plugin %s deactivated", plugin_id)

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------

    async def update(
        self,
        plugin_id: str,
        new_version: str,
        zip_path: Path,
    ) -> PluginInfo:
        """Update a plugin to a new version.

        1. Install new version alongside old
        2. Deactivate current
        3. Store current version as previous_version
        4. Run migrations
        5. Activate new version
        6. On failure: rollback
        """
        logger.info("Updating plugin %s to v%s", plugin_id, new_version)

        # Read current state
        async with async_session_factory() as session:
            result = await session.execute(
                select(InstalledPlugin).where(
                    InstalledPlugin.plugin_id == plugin_id
                )
            )
            record = result.scalar_one_or_none()
            if record is None:
                raise PluginNotFoundError(
                    f"Plugin '{plugin_id}' not found",
                    plugin_id=plugin_id,
                )
            old_version = record.version

        if old_version == new_version:
            raise PluginUpdateError(
                f"Plugin '{plugin_id}' is already at version {new_version}",
                plugin_id=plugin_id,
            )

        # 1. Extract new version
        data_dir = _get_plugin_data_dir()
        new_dir = data_dir / plugin_id / new_version
        if new_dir.exists():
            shutil.rmtree(new_dir)

        # Verify and extract
        sig_path = zip_path.with_suffix(".sig")
        if sig_path.exists():
            self._verifier.verify(zip_path, sig_path)

        _extract_plugin_zip(zip_path, new_dir)
        manifest = _parse_manifest(new_dir)

        # Version compat check
        panel_version = _read_panel_version()
        _check_version_compat(manifest, panel_version)

        # 2. Deactivate current
        if plugin_id in self._loaded:
            await self.deactivate(plugin_id)

        # 3. Update DB: set new version, store old as previous_version
        async with async_session_factory() as session:
            await session.execute(
                update(InstalledPlugin)
                .where(InstalledPlugin.plugin_id == plugin_id)
                .values(
                    version=new_version,
                    previous_version=old_version,
                    manifest=manifest,
                    status="installed",
                )
            )
            await session.commit()

        # 5. Activate new version
        try:
            info = await self.activate(plugin_id)
            await _publish_plugin_event(plugin_id, "updated")
            logger.info(
                "Plugin %s updated from v%s to v%s",
                plugin_id,
                old_version,
                new_version,
            )
            return info

        except Exception as exc:
            # 6. Rollback on failure
            logger.error(
                "Update failed for plugin %s v%s, rolling back to v%s: %s",
                plugin_id,
                new_version,
                old_version,
                exc,
            )
            try:
                await self._rollback_version(plugin_id, old_version, new_version)
            except Exception:
                logger.exception(
                    "Rollback also failed for plugin %s", plugin_id
                )

            raise PluginUpdateError(
                f"Update failed for plugin '{plugin_id}': {exc}",
                plugin_id=plugin_id,
            ) from exc

    # ------------------------------------------------------------------
    # Rollback
    # ------------------------------------------------------------------

    async def rollback(self, plugin_id: str) -> PluginInfo:
        """Roll back a plugin to its previous version."""
        logger.info("Rolling back plugin %s", plugin_id)

        async with async_session_factory() as session:
            result = await session.execute(
                select(InstalledPlugin).where(
                    InstalledPlugin.plugin_id == plugin_id
                )
            )
            record = result.scalar_one_or_none()
            if record is None:
                raise PluginNotFoundError(
                    f"Plugin '{plugin_id}' not found",
                    plugin_id=plugin_id,
                )

            if record.previous_version is None:
                raise PluginUpdateError(
                    f"No previous version available for plugin '{plugin_id}'",
                    plugin_id=plugin_id,
                )

            current_version = record.version
            previous_version = record.previous_version

        return await self._rollback_version(
            plugin_id, previous_version, current_version
        )

    async def _rollback_version(
        self,
        plugin_id: str,
        target_version: str,
        current_version: str,
    ) -> PluginInfo:
        """Internal rollback: deactivate current, swap versions, activate old."""
        # Deactivate current if loaded
        if plugin_id in self._loaded:
            await self.deactivate(plugin_id)

        # Run reverse migrations (best-effort)
        data_dir = _get_plugin_data_dir()
        current_path = data_dir / plugin_id / current_version
        try:
            from app.plugins.migration_runner import PluginMigrationRunner

            runner = PluginMigrationRunner(plugin_id, current_path)
            await runner.downgrade()
        except ImportError:
            logger.debug(
                "migration_runner not available, skipping reverse migration for %s",
                plugin_id,
            )
        except Exception:
            logger.exception(
                "Reverse migration failed for plugin %s", plugin_id
            )

        # Swap versions in DB
        async with async_session_factory() as session:
            await session.execute(
                update(InstalledPlugin)
                .where(InstalledPlugin.plugin_id == plugin_id)
                .values(
                    version=target_version,
                    previous_version=current_version,
                    status="installed",
                )
            )
            await session.commit()

        # Activate the old version
        info = await self.activate(plugin_id)
        await _publish_plugin_event(plugin_id, "rolled_back")
        logger.info(
            "Plugin %s rolled back from v%s to v%s",
            plugin_id,
            current_version,
            target_version,
        )
        return info

    # ------------------------------------------------------------------
    # Uninstall
    # ------------------------------------------------------------------

    async def uninstall(
        self,
        plugin_id: str,
        drop_tables: bool = False,
    ) -> None:
        """Completely remove a plugin.

        Deactivates, optionally drops plugin tables, removes files and DB record.
        """
        logger.info(
            "Uninstalling plugin %s (drop_tables=%s)", plugin_id, drop_tables
        )

        # Deactivate first if active
        if plugin_id in self._loaded:
            await self.deactivate(plugin_id)

        # Drop tables if requested
        if drop_tables:
            try:
                from app.plugins.migration_runner import PluginMigrationRunner

                async with async_session_factory() as session:
                    result = await session.execute(
                        select(InstalledPlugin).where(
                            InstalledPlugin.plugin_id == plugin_id
                        )
                    )
                    record = result.scalar_one_or_none()
                    if record:
                        plugin_path = (
                            _get_plugin_data_dir() / plugin_id / record.version
                        )
                        runner = PluginMigrationRunner(plugin_id, plugin_path)
                        await runner.downgrade(target="base")
            except ImportError:
                logger.debug(
                    "migration_runner not available, skipping table drop for %s",
                    plugin_id,
                )
            except Exception:
                logger.exception(
                    "Failed to drop tables for plugin %s", plugin_id
                )

        # Delete secrets
        secret_store = PluginSecretStore(plugin_id)
        await secret_store.delete_all()

        # Delete DB record
        async with async_session_factory() as session:
            result = await session.execute(
                select(InstalledPlugin).where(
                    InstalledPlugin.plugin_id == plugin_id
                )
            )
            record = result.scalar_one_or_none()
            if record:
                await session.delete(record)
                await session.commit()

        # Remove plugin files from disk
        plugin_dir = _get_plugin_data_dir() / plugin_id
        if plugin_dir.exists():
            shutil.rmtree(plugin_dir)
            logger.info("Removed plugin files at %s", plugin_dir)

        await _publish_plugin_event(plugin_id, "uninstalled")
        logger.info("Plugin %s uninstalled", plugin_id)

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def loaded_plugins(self) -> dict[str, _LoadedPlugin]:
        """Return dict of currently loaded plugins."""
        return dict(self._loaded)

    @property
    def event_bus(self) -> PluginEventBus:
        """Return the shared event bus instance."""
        return self._event_bus

    @property
    def handler_mount(self) -> HotSwappableRouter:
        """Return the bot handler mount for including in the main bot router."""
        return self._handler_mount

    def get_context(self, plugin_id: str) -> PluginContext | None:
        """Return the PluginContext for a loaded plugin, or None."""
        return self._contexts.get(plugin_id)
