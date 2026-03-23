"""
Scheduled background tasks.

- analyze_missed_knowledge: runs daily at 3:00 AM
  Extracts keywords from unmatched messages and upserts into missed_keywords.
"""
from __future__ import annotations

import logging
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.models.stats import MissedKeyword, MissedKeywordFilter, UnmatchedMessage
from app.utils.keyword_filter import keyword_matches_filter

logger = logging.getLogger(__name__)

# Common stopwords (Chinese + English) to filter out
STOPWORDS = {
    # Chinese
    "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都",
    "一", "个", "上", "也", "很", "到", "说", "要", "去", "你", "会",
    "着", "没有", "看", "好", "自己", "这", "他", "她", "它", "吗",
    "什么", "那", "里", "请问", "可以", "能", "吧", "啊", "呢", "哦",
    "嗯", "还", "把", "被", "让", "用", "对", "这个", "那个", "怎么",
    "为什么", "但是", "而且", "所以", "如果", "虽然", "因为",
    # English
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "i", "you", "he", "she", "it", "we", "they", "me", "him", "her",
    "us", "them", "my", "your", "his", "its", "our", "their", "mine",
    "yours", "hers", "ours", "theirs", "this", "that", "these", "those",
    "and", "but", "or", "not", "no", "if", "then", "so", "too", "very",
    "of", "in", "on", "at", "to", "for", "with", "by", "from", "about",
    "what", "how", "when", "where", "who", "which", "why", "hello", "hi",
    "please", "thank", "thanks", "ok", "okay",
}

# Minimum keyword length (characters)
MIN_KEYWORD_LEN = 2
# Minimum occurrence to record
MIN_OCCURRENCE = 2
# Max sample messages to store per keyword
MAX_SAMPLES = 5


def extract_keywords(texts: List[str]) -> Counter:
    """
    Simple keyword extraction by splitting on whitespace and punctuation,
    then counting filtered tokens.
    """
    counter: Counter = Counter()
    for text in texts:
        # Split on whitespace and common punctuation
        tokens = re.split(r"[\s,.\?!;:，。？！；：、\(\)\[\]\"'""'']+", text)
        for token in tokens:
            token = token.strip().lower()
            if len(token) < MIN_KEYWORD_LEN:
                continue
            if token in STOPWORDS:
                continue
            if token.isdigit():
                continue
            counter[token] += 1
    return counter


async def analyze_missed_knowledge() -> None:
    """
    Daily job: extract keywords from recent unmatched messages,
    upsert into missed_keywords, clean old messages.
    """
    logger.info("Starting missed knowledge analysis...")

    async with async_session_factory() as session:
        try:
            now = datetime.now(timezone.utc)
            yesterday = now - timedelta(hours=24)

            # 1. Fetch recent unmatched messages
            result = await session.execute(
                select(UnmatchedMessage).where(
                    UnmatchedMessage.created_at >= yesterday
                )
            )
            messages = result.scalars().all()

            if not messages:
                logger.info("No unmatched messages in the last 24h.")
                await _cleanup_old_messages(session, now)
                await session.commit()
                return

            texts = [m.text_content for m in messages if m.text_content]
            logger.info("Analyzing %d unmatched messages.", len(texts))

            # 2. Extract keywords
            keyword_counts = extract_keywords(texts)

            # 2b. Apply keyword filters
            filter_result = await session.execute(
                select(MissedKeywordFilter).where(
                    MissedKeywordFilter.is_active.is_(True)
                )
            )
            active_filters = filter_result.scalars().all()
            if active_filters:
                filtered_counts: Counter = Counter()
                for kw, count in keyword_counts.items():
                    if not any(
                        keyword_matches_filter(kw, f.pattern, f.match_mode)
                        for f in active_filters
                    ):
                        filtered_counts[kw] = count
                logger.info(
                    "Keyword filters removed %d of %d keywords.",
                    len(keyword_counts) - len(filtered_counts),
                    len(keyword_counts),
                )
                keyword_counts = filtered_counts

            # 3. Upsert into missed_keywords
            # Build a mapping of text -> sample messages for each keyword
            keyword_samples: dict[str, list[str]] = {}
            for text in texts:
                tokens = re.split(
                    r"[\s,.\?!;:，。？！；：、\(\)\[\]\"'""'']+", text
                )
                for token in tokens:
                    t = token.strip().lower()
                    if t in keyword_counts and keyword_counts[t] >= MIN_OCCURRENCE:
                        samples = keyword_samples.setdefault(t, [])
                        if len(samples) < MAX_SAMPLES and text not in samples:
                            samples.append(
                                text[:200] if len(text) > 200 else text
                            )

            upserted = 0
            for keyword, count in keyword_counts.most_common(100):
                if count < MIN_OCCURRENCE:
                    continue

                result = await session.execute(
                    select(MissedKeyword).where(
                        MissedKeyword.keyword == keyword,
                        MissedKeyword.is_resolved.is_(False),
                    )
                )
                existing = result.scalar_one_or_none()

                samples = keyword_samples.get(keyword, [])

                if existing:
                    existing.occurrence_count += count
                    existing.last_seen_at = now
                    existing.updated_at = now
                    # Append new samples (keep max)
                    current_samples = existing.sample_messages or []
                    for s in samples:
                        if s not in current_samples and len(current_samples) < MAX_SAMPLES:
                            current_samples.append(s)
                    existing.sample_messages = current_samples
                else:
                    new_kw = MissedKeyword(
                        keyword=keyword,
                        occurrence_count=count,
                        sample_messages=samples,
                        last_seen_at=now,
                        updated_at=now,
                        created_at=now,
                    )
                    session.add(new_kw)
                upserted += 1

            logger.info("Upserted %d missed keywords.", upserted)

            # 4. Clean old unmatched messages (>30 days)
            await _cleanup_old_messages(session, now)

            await session.commit()
            logger.info("Missed knowledge analysis completed.")

        except Exception:
            await session.rollback()
            logger.exception("Error during missed knowledge analysis")
            raise


async def _cleanup_old_messages(session: AsyncSession, now: datetime) -> None:
    """Delete unmatched messages older than 30 days."""
    cutoff = now - timedelta(days=30)
    result = await session.execute(
        delete(UnmatchedMessage).where(UnmatchedMessage.created_at < cutoff)
    )
    deleted = result.rowcount
    if deleted:
        logger.info("Cleaned up %d old unmatched messages.", deleted)


def setup_scheduler():
    """
    Configure and return an APScheduler instance with the daily job.
    Call this from the application startup.
    """
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger
    except ImportError:
        logger.warning(
            "APScheduler not installed. Missed knowledge analysis will not run. "
            "Install with: pip install apscheduler"
        )
        return None

    from apscheduler.triggers.interval import IntervalTrigger
    from app.oauth.token_refresh import refresh_expiring_tokens

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        analyze_missed_knowledge,
        trigger=CronTrigger(hour=3, minute=0),
        id="analyze_missed_knowledge",
        name="Daily missed knowledge analysis",
        replace_existing=True,
    )
    scheduler.add_job(
        refresh_expiring_tokens,
        trigger=IntervalTrigger(minutes=5),
        id="refresh_oauth_tokens",
        name="Refresh expiring OAuth tokens",
        replace_existing=True,
    )
    return scheduler
