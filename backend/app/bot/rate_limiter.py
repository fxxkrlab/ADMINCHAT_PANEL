"""
Redis-based rate limiter for Telegram bots (token-bucket algorithm).

Redis keys used:
  bot:limited:{bot_id}   -> TTL key indicating the bot is rate-limited
  bot:rate:{bot_id}:tokens -> remaining tokens (int)
  bot:rate:{bot_id}:last   -> last refill timestamp (float)
"""
from __future__ import annotations

import logging
import time
from typing import Optional, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bot import Bot
from app.services.redis import get_redis

logger = logging.getLogger(__name__)

# Token bucket defaults
BUCKET_MAX_TOKENS = 25  # per bot
REFILL_RATE = 20  # tokens per second (generous for private; TG allows ~30/s global)
REFILL_INTERVAL = 1.0  # seconds


async def is_rate_limited(bot_id: int) -> bool:
    """Return True if the bot is currently marked as rate-limited."""
    redis = await get_redis()
    val = await redis.get(f"bot:limited:{bot_id}")
    return val is not None


async def mark_rate_limited(bot_id: int, retry_after: int) -> None:
    """Mark a bot as rate-limited for *retry_after* seconds."""
    redis = await get_redis()
    ttl = max(retry_after, 1)
    await redis.setex(f"bot:limited:{bot_id}", ttl, "1")
    logger.warning("Bot %s rate-limited for %ss", bot_id, ttl)


async def consume_token(bot_id: int) -> bool:
    """
    Try to consume one token from the bot's bucket.
    Returns True if a token was available, False otherwise.
    """
    redis = await get_redis()
    tokens_key = f"bot:rate:{bot_id}:tokens"
    last_key = f"bot:rate:{bot_id}:last"

    now = time.time()

    # Fetch current state
    pipe = redis.pipeline(transaction=True)
    pipe.get(tokens_key)
    pipe.get(last_key)
    tokens_raw, last_raw = await pipe.execute()

    tokens = float(tokens_raw) if tokens_raw else float(BUCKET_MAX_TOKENS)
    last_refill = float(last_raw) if last_raw else now

    # Refill tokens based on elapsed time
    elapsed = now - last_refill
    tokens = min(BUCKET_MAX_TOKENS, tokens + elapsed * REFILL_RATE)

    if tokens < 1.0:
        return False

    tokens -= 1.0

    # Write back atomically
    pipe2 = redis.pipeline(transaction=True)
    pipe2.set(tokens_key, str(tokens), ex=300)
    pipe2.set(last_key, str(now), ex=300)
    await pipe2.execute()
    return True


async def get_available_bot(
    db: AsyncSession,
    exclude_bot_id: Optional[int] = None,
) -> Optional[Bot]:
    """Find the best available (non-rate-limited) bot from the pool."""
    stmt = select(Bot).where(Bot.is_active.is_(True))
    if exclude_bot_id is not None:
        stmt = stmt.where(Bot.id != exclude_bot_id)
    stmt = stmt.order_by(Bot.priority.desc())
    result = await db.execute(stmt)
    bots = result.scalars().all()

    for bot in bots:
        if not await is_rate_limited(bot.id):
            return bot
    return None


async def get_available_bots(
    db: AsyncSession,
    exclude_bot_id: Optional[int] = None,
) -> List[Bot]:
    """Return a list of all available (non-rate-limited) bots, ordered by priority."""
    stmt = select(Bot).where(Bot.is_active.is_(True))
    if exclude_bot_id is not None:
        stmt = stmt.where(Bot.id != exclude_bot_id)
    stmt = stmt.order_by(Bot.priority.desc())
    result = await db.execute(stmt)
    bots = list(result.scalars().all())

    available: List[Bot] = []
    for bot in bots:
        if not await is_rate_limited(bot.id):
            available.append(bot)
    return available
