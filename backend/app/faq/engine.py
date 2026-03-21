"""
FAQ matching engine.

Main entry point: ``match(text, db)`` loads all active rules ordered by
priority DESC, checks each rule's associated questions against the user
text, and returns the first match with answer(s) selected according to
the rule's response_mode.
"""
from __future__ import annotations

import logging
import random
from dataclasses import dataclass, field
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.faq import FaqRule, FaqRuleQuestion, FaqRuleAnswer
from app.faq.matcher import MATCHERS, MODE_PRIORITY

logger = logging.getLogger(__name__)


@dataclass
class FAQMatchResult:
    """Result returned when a user message matches an FAQ rule."""
    rule_id: int
    rule_name: Optional[str]
    matched_question_id: int
    matched_keyword: str
    match_mode: str
    answers: List[str] = field(default_factory=list)
    answer_content_types: List[str] = field(default_factory=list)
    answer_media_file_ids: List[Optional[str]] = field(default_factory=list)
    reply_mode: str = "direct"
    response_mode: str = "single"


async def match(text: str, db: AsyncSession) -> Optional[FAQMatchResult]:
    """
    Try to match *text* against all active FAQ rules.

    Returns a ``FAQMatchResult`` on the first hit, or ``None`` if nothing
    matches.
    """
    if not text or not text.strip():
        return None

    text = text.strip()

    # Load all active rules with their questions and answers eagerly
    stmt = (
        select(FaqRule)
        .where(FaqRule.is_active.is_(True))
        .options(
            selectinload(FaqRule.rule_questions).selectinload(FaqRuleQuestion.question),
            selectinload(FaqRule.rule_answers).selectinload(FaqRuleAnswer.answer),
        )
        .order_by(FaqRule.priority.desc(), FaqRule.id.asc())
    )
    result = await db.execute(stmt)
    rules = result.scalars().all()

    for rule in rules:
        # Gather questions sorted by match_mode priority (exact first)
        questions = []
        for rq in rule.rule_questions:
            q = rq.question
            if q and q.is_active:
                questions.append(q)

        # Sort by match_mode priority for deterministic tie-breaking
        questions.sort(key=lambda q: MODE_PRIORITY.get(q.match_mode, 99))

        for question in questions:
            matcher_fn = MATCHERS.get(question.match_mode)
            if matcher_fn is None:
                logger.warning(
                    "Unknown match_mode %r on question id=%s",
                    question.match_mode,
                    question.id,
                )
                continue

            if matcher_fn(text, question.keyword):
                # Match found! Build answer list
                answers = _select_answers(rule)
                return FAQMatchResult(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    matched_question_id=question.id,
                    matched_keyword=question.keyword,
                    match_mode=question.match_mode,
                    answers=[a["content"] for a in answers],
                    answer_content_types=[a["content_type"] for a in answers],
                    answer_media_file_ids=[a.get("media_file_id") for a in answers],
                    reply_mode=rule.reply_mode,
                    response_mode=rule.response_mode,
                )

    return None


def _select_answers(rule: FaqRule) -> List[dict]:
    """Pick answers based on the rule's response_mode."""
    active_answers = []
    for ra in rule.rule_answers:
        a = ra.answer
        if a and a.is_active:
            active_answers.append({
                "content": a.content,
                "content_type": a.content_type,
                "media_file_id": a.media_file_id,
            })

    if not active_answers:
        return []

    mode = rule.response_mode

    if mode == "single":
        return [active_answers[0]]
    elif mode == "random":
        return [random.choice(active_answers)]
    elif mode == "all":
        return active_answers
    else:
        # Fallback to single
        return [active_answers[0]]
