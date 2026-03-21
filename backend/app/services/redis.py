"""
Redis connection pool singleton for the application.
"""
from __future__ import annotations

import logging
from typing import Optional

import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)

_pool: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    """Return the shared Redis connection (lazy-init)."""
    global _pool
    if _pool is None:
        _pool = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=50,
        )
        logger.info("Redis connection pool created: %s", settings.REDIS_URL)
    return _pool


async def close_redis() -> None:
    """Close the shared Redis connection pool."""
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None
        logger.info("Redis connection pool closed")
