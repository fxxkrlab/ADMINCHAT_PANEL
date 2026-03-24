from __future__ import annotations

import logging
import os
from pathlib import Path

from cryptography.fernet import Fernet
from sqlalchemy import delete, select

from app.database import async_session_factory
from app.plugins.registry import PluginSecret

logger = logging.getLogger("acp.plugins.secret_store")

_KEY_ENV_VAR = "PLUGIN_SECRET_KEY"
_KEY_FILE_PATH = Path("/data/.plugin_secret_key")


def _load_or_generate_key() -> bytes:
    """Load Fernet key from env var or file, generating one if neither exists."""
    env_key = os.environ.get(_KEY_ENV_VAR)
    if env_key:
        return env_key.encode()

    if _KEY_FILE_PATH.exists():
        return _KEY_FILE_PATH.read_text().strip().encode()

    logger.warning(
        "No %s env var found, generating new key at %s",
        _KEY_ENV_VAR,
        _KEY_FILE_PATH,
    )
    key = Fernet.generate_key()
    _KEY_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _KEY_FILE_PATH.write_bytes(key)
    _KEY_FILE_PATH.chmod(0o600)
    return key


class PluginSecretStore:
    """Encrypted key-value store scoped to a single plugin.

    Uses Fernet symmetric encryption. Keys are stored in the
    plugin_secrets table with encrypted values.
    """

    def __init__(self, plugin_id: str) -> None:
        self.plugin_id = plugin_id
        self._fernet = Fernet(_load_or_generate_key())

    async def get(self, key: str) -> str | None:
        """Retrieve and decrypt a secret value by key."""
        async with async_session_factory() as session:
            result = await session.execute(
                select(PluginSecret).where(
                    PluginSecret.plugin_id == self.plugin_id,
                    PluginSecret.key == key,
                )
            )
            secret = result.scalar_one_or_none()
            if secret is None:
                return None
            return self._fernet.decrypt(secret.value.encode()).decode()

    async def set(self, key: str, value: str) -> None:
        """Encrypt and upsert a secret value."""
        encrypted = self._fernet.encrypt(value.encode()).decode()
        async with async_session_factory() as session:
            result = await session.execute(
                select(PluginSecret).where(
                    PluginSecret.plugin_id == self.plugin_id,
                    PluginSecret.key == key,
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                existing.value = encrypted
            else:
                session.add(
                    PluginSecret(
                        plugin_id=self.plugin_id,
                        key=key,
                        value=encrypted,
                    )
                )
            await session.commit()

    async def delete(self, key: str) -> bool:
        """Delete a secret by key. Returns True if a secret was deleted."""
        async with async_session_factory() as session:
            result = await session.execute(
                delete(PluginSecret).where(
                    PluginSecret.plugin_id == self.plugin_id,
                    PluginSecret.key == key,
                )
            )
            await session.commit()
            return result.rowcount > 0

    async def list_keys(self) -> list[str]:
        """Return all secret key names for this plugin."""
        async with async_session_factory() as session:
            result = await session.execute(
                select(PluginSecret.key).where(
                    PluginSecret.plugin_id == self.plugin_id,
                )
            )
            return list(result.scalars().all())

    async def delete_all(self) -> None:
        """Delete all secrets for this plugin."""
        async with async_session_factory() as session:
            await session.execute(
                delete(PluginSecret).where(
                    PluginSecret.plugin_id == self.plugin_id,
                )
            )
            await session.commit()
        logger.info("Deleted all secrets for plugin %s", self.plugin_id)
