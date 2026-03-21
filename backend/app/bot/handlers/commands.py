"""
Handler for admin-only bot commands.
Currently supports: /FAQRanking
"""
from __future__ import annotations

import logging
from datetime import date, timedelta

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message as TgMessage
from sqlalchemy import select, func

from app.database import async_session_factory
from app.models.admin import Admin
from app.models.stats import FaqHitStat
from app.models.faq import FaqRule

logger = logging.getLogger(__name__)

router = Router(name="commands")


@router.message(Command("FAQRanking"))
async def handle_faq_ranking(message: TgMessage) -> None:
    """
    /FAQRanking — Show top 10 FAQ hit statistics.
    Only responds to admins (tg_user_id present in admins table).
    """
    tg_user = message.from_user
    if tg_user is None:
        return

    async with async_session_factory() as session:
        # ---- Verify admin ----
        result = await session.execute(
            select(Admin).where(
                Admin.tg_user_id == tg_user.id,
                Admin.is_active.is_(True),
            )
        )
        admin = result.scalar_one_or_none()
        if admin is None:
            logger.debug(
                "Non-admin user tg_uid=%s tried /FAQRanking, ignoring",
                tg_user.id,
            )
            return

        # ---- Query top 10 FAQ rules by total hits ----
        # Aggregate hit_count across all dates per rule
        stmt = (
            select(
                FaqRule.name,
                func.sum(FaqHitStat.hit_count).label("total_hits"),
            )
            .join(FaqHitStat, FaqHitStat.faq_rule_id == FaqRule.id)
            .where(FaqRule.is_active.is_(True))
            .group_by(FaqRule.id, FaqRule.name)
            .order_by(func.sum(FaqHitStat.hit_count).desc())
            .limit(10)
        )
        result = await session.execute(stmt)
        rows = result.all()

    if not rows:
        await message.reply("📊 暂无 FAQ 命中数据。")
        return

    lines = ["📊 FAQ 问题排行榜 (Top 10)\n"]
    for idx, (name, total_hits) in enumerate(rows, start=1):
        display_name = name or "未命名规则"
        lines.append(f"{idx}. {display_name} — {total_hits} 次")

    await message.reply("\n".join(lines))
