"""
Media cache service.

Downloads media files from Telegram, caches them locally,
and provides access + cleanup for expired files.
"""
from __future__ import annotations

import hashlib
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Default cache directory (can be overridden via settings)
DEFAULT_CACHE_DIR = "/tmp/adminchat_media_cache"
DEFAULT_TTL_DAYS = 7


class MediaCacheService:
    """
    Manages local caching of Telegram media files.

    Files are stored in a flat directory structure using file_id as the key.
    """

    def __init__(
        self,
        cache_dir: str = DEFAULT_CACHE_DIR,
        ttl_days: int = DEFAULT_TTL_DAYS,
    ):
        self.cache_dir = Path(cache_dir)
        self.ttl_days = ttl_days
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _cache_path(self, file_id: str) -> Path:
        """Get the local cache path for a given TG file_id."""
        # Use a hash to avoid filesystem issues with long file_ids
        safe_name = hashlib.sha256(file_id.encode()).hexdigest()
        return self.cache_dir / safe_name

    async def cache_media(
        self,
        file_id: str,
        bot,  # aiogram Bot instance
    ) -> Optional[str]:
        """
        Download a file from Telegram and cache it locally.

        Args:
            file_id: Telegram file_id string.
            bot: An aiogram Bot instance to download from.

        Returns:
            Local file path string, or None if download failed.
        """
        cache_path = self._cache_path(file_id)

        # Already cached and not expired
        if cache_path.exists():
            mtime = cache_path.stat().st_mtime
            age_days = (time.time() - mtime) / 86400
            if age_days < self.ttl_days:
                return str(cache_path)

        try:
            # Download from Telegram
            tg_file = await bot.get_file(file_id)
            await bot.download_file(tg_file.file_path, destination=str(cache_path))
            logger.info("Cached media file_id=%s to %s", file_id, cache_path)
            return str(cache_path)
        except Exception:
            logger.exception("Failed to cache media file_id=%s", file_id)
            return None

    def get_cached_media(self, file_id: str) -> Optional[str]:
        """
        Return the local cached file path if it exists and is not expired.

        Args:
            file_id: Telegram file_id string.

        Returns:
            File path string, or None if not cached/expired.
        """
        cache_path = self._cache_path(file_id)

        if not cache_path.exists():
            return None

        # Check TTL
        mtime = cache_path.stat().st_mtime
        age_days = (time.time() - mtime) / 86400
        if age_days >= self.ttl_days:
            return None

        return str(cache_path)

    def cleanup_expired_cache(self) -> int:
        """
        Delete all cached files that are past their TTL.

        This should be called by a scheduled task (e.g., daily cron).

        Returns:
            Number of files deleted.
        """
        deleted = 0
        cutoff = time.time() - (self.ttl_days * 86400)

        if not self.cache_dir.exists():
            return 0

        for file_path in self.cache_dir.iterdir():
            if file_path.is_file() and file_path.stat().st_mtime < cutoff:
                try:
                    file_path.unlink()
                    deleted += 1
                except OSError:
                    logger.warning("Failed to delete expired cache file: %s", file_path)

        if deleted:
            logger.info("Media cache cleanup: deleted %d expired files", deleted)

        return deleted


# Module-level singleton
media_cache = MediaCacheService()
