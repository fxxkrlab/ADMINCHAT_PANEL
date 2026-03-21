from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.admin import Admin
from app.models.bot import Bot
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.stats import FaqHitStat, MissedKeyword
from app.models.user import TgUser
from app.schemas.common import APIResponse

router = APIRouter()


@router.get("/dashboard", response_model=APIResponse)
async def get_dashboard_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(get_current_user)],
) -> APIResponse:
    """Get dashboard statistics with real DB queries."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    last_period_start = today_start - timedelta(days=7)
    prev_period_start = last_period_start - timedelta(days=7)

    # Total conversations
    total_conv_result = await db.execute(select(func.count(Conversation.id)))
    total_conversations = total_conv_result.scalar() or 0

    # Open conversations
    open_conv_result = await db.execute(
        select(func.count(Conversation.id)).where(Conversation.status == "open")
    )
    open_conversations = open_conv_result.scalar() or 0

    # Resolved conversations
    resolved_conv_result = await db.execute(
        select(func.count(Conversation.id)).where(Conversation.status == "resolved")
    )
    resolved_conversations = resolved_conv_result.scalar() or 0

    # Blocked users
    blocked_result = await db.execute(
        select(func.count(TgUser.id)).where(TgUser.is_blocked == True)  # noqa: E712
    )
    blocked_users = blocked_result.scalar() or 0

    # Messages today
    messages_today_result = await db.execute(
        select(func.count(Message.id)).where(Message.created_at >= today_start)
    )
    total_messages_today = messages_today_result.scalar() or 0

    # Messages yesterday (for trend)
    messages_yesterday_result = await db.execute(
        select(func.count(Message.id)).where(
            and_(
                Message.created_at >= yesterday_start,
                Message.created_at < today_start,
            )
        )
    )
    messages_yesterday = messages_yesterday_result.scalar() or 0

    # FAQ hit rate: faq_matched messages vs total inbound messages (last 7 days)
    total_inbound_result = await db.execute(
        select(func.count(Message.id)).where(
            and_(
                Message.direction == "inbound",
                Message.created_at >= last_period_start,
            )
        )
    )
    total_inbound = total_inbound_result.scalar() or 0

    faq_matched_result = await db.execute(
        select(func.count(Message.id)).where(
            and_(
                Message.direction == "inbound",
                Message.faq_matched == True,  # noqa: E712
                Message.created_at >= last_period_start,
            )
        )
    )
    faq_matched = faq_matched_result.scalar() or 0

    faq_hit_rate = round(faq_matched / total_inbound, 2) if total_inbound > 0 else 0.0

    # Active bots (is_active and not rate limited)
    active_bots_result = await db.execute(
        select(func.count(Bot.id)).where(
            and_(
                Bot.is_active == True,  # noqa: E712
                Bot.is_rate_limited == False,  # noqa: E712
            )
        )
    )
    active_bots = active_bots_result.scalar() or 0

    total_bots_result = await db.execute(
        select(func.count(Bot.id)).where(Bot.is_active == True)  # noqa: E712
    )
    total_bots = total_bots_result.scalar() or 0

    # Trend: conversations this week vs last week
    conv_this_week_result = await db.execute(
        select(func.count(Conversation.id)).where(Conversation.created_at >= last_period_start)
    )
    conv_this_week = conv_this_week_result.scalar() or 0

    conv_last_week_result = await db.execute(
        select(func.count(Conversation.id)).where(
            and_(
                Conversation.created_at >= prev_period_start,
                Conversation.created_at < last_period_start,
            )
        )
    )
    conv_last_week = conv_last_week_result.scalar() or 0

    # Calculate trend percentages
    def calc_trend(current: int, previous: int) -> float:
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return round(((current - previous) / previous) * 100, 1)

    conv_trend = calc_trend(conv_this_week, conv_last_week)
    msg_trend = calc_trend(total_messages_today, messages_yesterday)

    # Bot pool status
    bots_result = await db.execute(
        select(Bot).where(Bot.is_active == True).order_by(Bot.priority.desc())  # noqa: E712
    )
    bots = bots_result.scalars().all()

    bot_pool = []
    for bot in bots:
        if bot.is_rate_limited:
            bot_status = "limited"
            remaining = None
            if bot.rate_limit_until:
                remaining = max(0, int((bot.rate_limit_until - now).total_seconds()))
            bot_pool.append({
                "id": bot.id,
                "name": bot.display_name or bot.bot_username or f"Bot #{bot.id}",
                "username": bot.bot_username,
                "status": bot_status,
                "rate_limit_remaining": remaining,
            })
        else:
            bot_pool.append({
                "id": bot.id,
                "name": bot.display_name or bot.bot_username or f"Bot #{bot.id}",
                "username": bot.bot_username,
                "status": "online",
                "rate_limit_remaining": None,
            })

    # FAQ ranking (top 5)
    faq_ranking_result = await db.execute(
        select(
            FaqHitStat.faq_rule_id,
            func.sum(FaqHitStat.hit_count).label("total_hits"),
        )
        .group_by(FaqHitStat.faq_rule_id)
        .order_by(func.sum(FaqHitStat.hit_count).desc())
        .limit(5)
    )
    faq_ranking_rows = faq_ranking_result.all()

    faq_top = []
    for row in faq_ranking_rows:
        # Get rule name
        from app.models.faq import FaqRule
        rule_result = await db.execute(
            select(FaqRule.name).where(FaqRule.id == row.faq_rule_id)
        )
        rule_name = rule_result.scalar() or f"Rule #{row.faq_rule_id}"
        faq_top.append({
            "rule_id": row.faq_rule_id,
            "name": rule_name,
            "hits": row.total_hits,
        })

    # Missed keywords (top 5 unresolved)
    missed_result = await db.execute(
        select(MissedKeyword)
        .where(MissedKeyword.is_resolved == False)  # noqa: E712
        .order_by(MissedKeyword.occurrence_count.desc())
        .limit(5)
    )
    missed_keywords = missed_result.scalars().all()

    missed_top = [
        {
            "id": mk.id,
            "keyword": mk.keyword,
            "count": mk.occurrence_count,
            "last_seen": mk.last_seen_at.isoformat() if mk.last_seen_at else None,
        }
        for mk in missed_keywords
    ]

    return APIResponse(
        data={
            "total_conversations": total_conversations,
            "open_conversations": open_conversations,
            "resolved_conversations": resolved_conversations,
            "blocked_users": blocked_users,
            "total_messages_today": total_messages_today,
            "faq_hit_rate": faq_hit_rate,
            "active_bots": active_bots,
            "total_bots": total_bots,
            "trends": {
                "conversations": conv_trend,
                "messages": msg_trend,
            },
            "bot_pool": bot_pool,
            "faq_top": faq_top,
            "missed_keywords": missed_top,
        }
    )
