"""Per-plugin Alembic migration runner."""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path

logger = logging.getLogger("acp.plugins.migration_runner")


class PluginMigrationRunner:
    """Run per-plugin Alembic migrations.

    Each plugin has its own migration chain tracked in a separate
    version table: plg_{plugin_id}_alembic_version
    """

    def __init__(self, plugin_id: str, plugin_path: Path) -> None:
        self._plugin_id = plugin_id
        self._plugin_path = plugin_path

    def _get_db_url(self) -> str:
        from app.config import settings
        return str(settings.DATABASE_URL)

    def _build_config(self):
        from alembic.config import Config as AlembicConfig

        migrations_dir = self._plugin_path / "backend" / "migrations"
        if not migrations_dir.exists():
            return None

        config = AlembicConfig()
        config.set_main_option("script_location", str(migrations_dir))
        config.set_main_option("sqlalchemy.url", self._get_db_url().replace("+asyncpg", ""))
        config.set_main_option("version_table", f"plg_{self._plugin_id}_alembic_version")
        return config

    async def upgrade(self, target: str = "head") -> None:
        config = self._build_config()
        if config is None:
            logger.debug("No migrations directory for plugin %s", self._plugin_id)
            return

        from alembic import command as alembic_command
        await asyncio.to_thread(alembic_command.upgrade, config, target)
        logger.info("Migrations upgraded to %s for plugin %s", target, self._plugin_id)

    async def downgrade(self, target: str = "-1") -> None:
        config = self._build_config()
        if config is None:
            return

        from alembic import command as alembic_command
        await asyncio.to_thread(alembic_command.downgrade, config, target)
        logger.info("Migrations downgraded to %s for plugin %s", target, self._plugin_id)
