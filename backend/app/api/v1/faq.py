"""
FAQ management API endpoints.

GET    /faq/questions          - list all questions
POST   /faq/questions          - create question
PATCH  /faq/questions/:id      - update question
DELETE /faq/questions/:id      - delete question
GET    /faq/answers            - list all answers
POST   /faq/answers            - create answer
PATCH  /faq/answers/:id        - update answer
DELETE /faq/answers/:id        - delete answer
GET    /faq/rules              - list all rules with associations
POST   /faq/rules              - create rule
PATCH  /faq/rules/:id          - update rule
DELETE /faq/rules/:id          - delete rule
GET    /faq/ranking            - hit stats ranking
GET    /faq/missed-keywords    - missed knowledge ranking
DELETE /faq/missed-keywords/:id - remove keyword
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, require_admin, get_current_active_user
from app.models.admin import Admin
from app.models.faq import (
    FaqAnswer,
    FaqQuestion,
    FaqRule,
    FaqRuleAnswer,
    FaqRuleQuestion,
)
from app.models.stats import FaqHitStat, MissedKeyword
from app.schemas.common import APIResponse
from app.services.audit import log_action
from app.schemas.faq import (
    FAQAnswerCreate,
    FAQAnswerResponse,
    FAQAnswerUpdate,
    FAQQuestionCreate,
    FAQQuestionResponse,
    FAQQuestionUpdate,
    FAQRankingItem,
    FAQRuleCreate,
    FAQRuleResponse,
    FAQRuleUpdate,
    MissedKeywordItem,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================
# Questions
# ============================================================

@router.get("/questions", response_model=APIResponse)
async def list_questions(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    """List all FAQ questions/keywords."""
    result = await db.execute(
        select(FaqQuestion).order_by(FaqQuestion.id.desc())
    )
    questions = result.scalars().all()
    items = [FAQQuestionResponse.model_validate(q) for q in questions]
    return APIResponse(data=[i.model_dump(mode="json") for i in items])


@router.post(
    "/questions",
    response_model=APIResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_question(
    body: FAQQuestionCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    """Create a new FAQ question/keyword."""
    question = FaqQuestion(
        keyword=body.keyword,
        match_mode=body.match_mode,
    )
    db.add(question)
    await db.flush()
    await db.refresh(question)
    return APIResponse(
        code=201,
        message="Question created",
        data=FAQQuestionResponse.model_validate(question).model_dump(mode="json"),
    )


@router.patch("/questions/{question_id}", response_model=APIResponse)
async def update_question(
    question_id: int,
    body: FAQQuestionUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    """Update an existing FAQ question."""
    result = await db.execute(
        select(FaqQuestion).where(FaqQuestion.id == question_id)
    )
    question = result.scalar_one_or_none()
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(question, field, value)

    await db.flush()
    await db.refresh(question)
    return APIResponse(
        data=FAQQuestionResponse.model_validate(question).model_dump(mode="json")
    )


@router.delete("/questions/{question_id}", response_model=APIResponse)
async def delete_question(
    question_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    """Delete a FAQ question."""
    result = await db.execute(
        select(FaqQuestion).where(FaqQuestion.id == question_id)
    )
    question = result.scalar_one_or_none()
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")

    await db.delete(question)
    return APIResponse(message="Question deleted")


# ============================================================
# Answers
# ============================================================

@router.get("/answers", response_model=APIResponse)
async def list_answers(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    """List all FAQ answers."""
    result = await db.execute(
        select(FaqAnswer).order_by(FaqAnswer.id.desc())
    )
    answers = result.scalars().all()
    items = [FAQAnswerResponse.model_validate(a) for a in answers]
    return APIResponse(data=[i.model_dump(mode="json") for i in items])


@router.post(
    "/answers",
    response_model=APIResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_answer(
    body: FAQAnswerCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    """Create a new FAQ answer."""
    answer = FaqAnswer(
        content=body.content,
        content_type=body.content_type,
        media_file_id=body.media_file_id,
    )
    db.add(answer)
    await db.flush()
    await db.refresh(answer)
    return APIResponse(
        code=201,
        message="Answer created",
        data=FAQAnswerResponse.model_validate(answer).model_dump(mode="json"),
    )


@router.patch("/answers/{answer_id}", response_model=APIResponse)
async def update_answer(
    answer_id: int,
    body: FAQAnswerUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    """Update an existing FAQ answer."""
    result = await db.execute(
        select(FaqAnswer).where(FaqAnswer.id == answer_id)
    )
    answer = result.scalar_one_or_none()
    if answer is None:
        raise HTTPException(status_code=404, detail="Answer not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(answer, field, value)

    await db.flush()
    await db.refresh(answer)
    return APIResponse(
        data=FAQAnswerResponse.model_validate(answer).model_dump(mode="json")
    )


@router.delete("/answers/{answer_id}", response_model=APIResponse)
async def delete_answer(
    answer_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    """Delete a FAQ answer."""
    result = await db.execute(
        select(FaqAnswer).where(FaqAnswer.id == answer_id)
    )
    answer = result.scalar_one_or_none()
    if answer is None:
        raise HTTPException(status_code=404, detail="Answer not found")

    await db.delete(answer)
    return APIResponse(message="Answer deleted")


# ============================================================
# Rules
# ============================================================

@router.get("/rules", response_model=APIResponse)
async def list_rules(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
    reply_mode: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
):
    """List all FAQ rules with associated questions and answers."""
    stmt = (
        select(FaqRule)
        .options(
            selectinload(FaqRule.rule_questions).selectinload(FaqRuleQuestion.question),
            selectinload(FaqRule.rule_answers).selectinload(FaqRuleAnswer.answer),
        )
        .order_by(FaqRule.priority.desc(), FaqRule.id.desc())
    )

    if reply_mode is not None:
        stmt = stmt.where(FaqRule.reply_mode == reply_mode)
    if is_active is not None:
        stmt = stmt.where(FaqRule.is_active == is_active)

    result = await db.execute(stmt)
    rules = result.scalars().unique().all()

    items = []
    for rule in rules:
        # Compute total hit count for this rule
        hit_result = await db.execute(
            select(func.coalesce(func.sum(FaqHitStat.hit_count), 0)).where(
                FaqHitStat.faq_rule_id == rule.id
            )
        )
        total_hits = hit_result.scalar() or 0

        rule_data = FAQRuleResponse(
            id=rule.id,
            name=rule.name,
            response_mode=rule.response_mode,
            reply_mode=rule.reply_mode,
            ai_config=rule.ai_config or {},
            priority=rule.priority,
            daily_ai_limit=rule.daily_ai_limit,
            is_active=rule.is_active,
            questions=[
                FAQQuestionResponse.model_validate(rq.question)
                for rq in rule.rule_questions
                if rq.question
            ],
            answers=[
                FAQAnswerResponse.model_validate(ra.answer)
                for ra in rule.rule_answers
                if ra.answer
            ],
            hit_count=total_hits,
            created_at=rule.created_at,
            updated_at=rule.updated_at,
        )
        items.append(rule_data.model_dump(mode="json"))

    return APIResponse(data=items)


@router.post(
    "/rules",
    response_model=APIResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_rule(
    body: FAQRuleCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    """Create a new FAQ rule with question and answer associations."""
    rule = FaqRule(
        name=body.name,
        response_mode=body.response_mode,
        reply_mode=body.reply_mode,
        ai_config=body.ai_config,
        priority=body.priority,
        daily_ai_limit=body.daily_ai_limit,
        is_active=body.is_active,
    )
    db.add(rule)
    await db.flush()

    # Associate questions
    for qid in body.question_ids:
        q_result = await db.execute(
            select(FaqQuestion).where(FaqQuestion.id == qid)
        )
        if q_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=400, detail=f"Question id={qid} not found"
            )
        db.add(FaqRuleQuestion(rule_id=rule.id, question_id=qid))

    # Associate answers
    for aid in body.answer_ids:
        a_result = await db.execute(
            select(FaqAnswer).where(FaqAnswer.id == aid)
        )
        if a_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=400, detail=f"Answer id={aid} not found"
            )
        db.add(FaqRuleAnswer(rule_id=rule.id, answer_id=aid))

    await db.flush()

    # Reload with relationships
    stmt = (
        select(FaqRule)
        .where(FaqRule.id == rule.id)
        .options(
            selectinload(FaqRule.rule_questions).selectinload(FaqRuleQuestion.question),
            selectinload(FaqRule.rule_answers).selectinload(FaqRuleAnswer.answer),
        )
    )
    result = await db.execute(stmt)
    rule = result.scalar_one()

    rule_resp = FAQRuleResponse(
        id=rule.id,
        name=rule.name,
        response_mode=rule.response_mode,
        reply_mode=rule.reply_mode,
        ai_config=rule.ai_config or {},
        priority=rule.priority,
        daily_ai_limit=rule.daily_ai_limit,
        is_active=rule.is_active,
        questions=[
            FAQQuestionResponse.model_validate(rq.question)
            for rq in rule.rule_questions
            if rq.question
        ],
        answers=[
            FAQAnswerResponse.model_validate(ra.answer)
            for ra in rule.rule_answers
            if ra.answer
        ],
        hit_count=0,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
    )

    await log_action(
        db, _current_user.id, "create_faq_rule", "faq_rule", rule.id,
        {"name": rule.name},
        request.client.host if request.client else None,
    )

    return APIResponse(
        code=201,
        message="Rule created",
        data=rule_resp.model_dump(mode="json"),
    )


@router.patch("/rules/{rule_id}", response_model=APIResponse)
async def update_rule(
    rule_id: int,
    body: FAQRuleUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    """Update an existing FAQ rule."""
    result = await db.execute(
        select(FaqRule)
        .where(FaqRule.id == rule_id)
        .options(
            selectinload(FaqRule.rule_questions),
            selectinload(FaqRule.rule_answers),
        )
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(status_code=404, detail="Rule not found")

    update_data = body.model_dump(exclude_unset=True)

    # Handle question_ids reassociation
    if "question_ids" in update_data:
        question_ids = update_data.pop("question_ids")
        # Remove old associations
        await db.execute(
            delete(FaqRuleQuestion).where(FaqRuleQuestion.rule_id == rule.id)
        )
        # Add new ones
        for qid in question_ids:
            q_result = await db.execute(
                select(FaqQuestion).where(FaqQuestion.id == qid)
            )
            if q_result.scalar_one_or_none() is None:
                raise HTTPException(
                    status_code=400, detail=f"Question id={qid} not found"
                )
            db.add(FaqRuleQuestion(rule_id=rule.id, question_id=qid))

    # Handle answer_ids reassociation
    if "answer_ids" in update_data:
        answer_ids = update_data.pop("answer_ids")
        await db.execute(
            delete(FaqRuleAnswer).where(FaqRuleAnswer.rule_id == rule.id)
        )
        for aid in answer_ids:
            a_result = await db.execute(
                select(FaqAnswer).where(FaqAnswer.id == aid)
            )
            if a_result.scalar_one_or_none() is None:
                raise HTTPException(
                    status_code=400, detail=f"Answer id={aid} not found"
                )
            db.add(FaqRuleAnswer(rule_id=rule.id, answer_id=aid))

    # Update scalar fields
    for field, value in update_data.items():
        setattr(rule, field, value)

    await db.flush()

    # Reload with relationships
    stmt = (
        select(FaqRule)
        .where(FaqRule.id == rule.id)
        .options(
            selectinload(FaqRule.rule_questions).selectinload(FaqRuleQuestion.question),
            selectinload(FaqRule.rule_answers).selectinload(FaqRuleAnswer.answer),
        )
    )
    result = await db.execute(stmt)
    rule = result.scalar_one()

    hit_result = await db.execute(
        select(func.coalesce(func.sum(FaqHitStat.hit_count), 0)).where(
            FaqHitStat.faq_rule_id == rule.id
        )
    )
    total_hits = hit_result.scalar() or 0

    rule_resp = FAQRuleResponse(
        id=rule.id,
        name=rule.name,
        response_mode=rule.response_mode,
        reply_mode=rule.reply_mode,
        ai_config=rule.ai_config or {},
        priority=rule.priority,
        daily_ai_limit=rule.daily_ai_limit,
        is_active=rule.is_active,
        questions=[
            FAQQuestionResponse.model_validate(rq.question)
            for rq in rule.rule_questions
            if rq.question
        ],
        answers=[
            FAQAnswerResponse.model_validate(ra.answer)
            for ra in rule.rule_answers
            if ra.answer
        ],
        hit_count=total_hits,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
    )

    await log_action(
        db, _current_user.id, "update_faq_rule", "faq_rule", rule_id,
        {"name": rule.name},
        request.client.host if request.client else None,
    )

    return APIResponse(data=rule_resp.model_dump(mode="json"))


@router.delete("/rules/{rule_id}", response_model=APIResponse)
async def delete_rule(
    rule_id: int,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    """Delete a FAQ rule."""
    result = await db.execute(
        select(FaqRule).where(FaqRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(status_code=404, detail="Rule not found")

    await log_action(
        db, _current_user.id, "delete_faq_rule", "faq_rule", rule_id,
        {"name": rule.name},
        request.client.host if request.client else None,
    )
    await db.delete(rule)
    return APIResponse(message="Rule deleted")


# ============================================================
# Ranking & Missed Keywords
# ============================================================

@router.get("/ranking", response_model=APIResponse)
async def get_ranking(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(get_current_active_user)],
    period: Optional[str] = Query(None, pattern="^(today|week|month|all)$"),
):
    """Get FAQ hit ranking with optional date filtering."""
    stmt = select(
        FaqHitStat.faq_rule_id,
        func.sum(FaqHitStat.hit_count).label("total_hits"),
        func.max(FaqHitStat.last_hit_at).label("last_hit"),
    )

    if period == "today":
        today = date.today()
        stmt = stmt.where(FaqHitStat.date == today)
    elif period == "week":
        week_ago = date.today() - timedelta(days=7)
        stmt = stmt.where(FaqHitStat.date >= week_ago)
    elif period == "month":
        month_ago = date.today() - timedelta(days=30)
        stmt = stmt.where(FaqHitStat.date >= month_ago)
    # "all" or None — no date filter

    stmt = (
        stmt.group_by(FaqHitStat.faq_rule_id)
        .order_by(func.sum(FaqHitStat.hit_count).desc())
        .limit(50)
    )

    result = await db.execute(stmt)
    rows = result.all()

    # Fetch rule names
    rule_ids = [r.faq_rule_id for r in rows]
    rules_map = {}
    if rule_ids:
        rules_result = await db.execute(
            select(FaqRule.id, FaqRule.name).where(FaqRule.id.in_(rule_ids))
        )
        rules_map = {r.id: r.name for r in rules_result.all()}

    items = [
        FAQRankingItem(
            rule_id=r.faq_rule_id,
            rule_name=rules_map.get(r.faq_rule_id),
            hit_count=r.total_hits,
            last_hit_at=r.last_hit,
        ).model_dump(mode="json")
        for r in rows
    ]

    return APIResponse(data=items)


@router.get("/missed-keywords", response_model=APIResponse)
async def list_missed_keywords(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    """List missed knowledge keywords sorted by occurrence count."""
    result = await db.execute(
        select(MissedKeyword)
        .where(MissedKeyword.is_resolved.is_(False))
        .order_by(MissedKeyword.occurrence_count.desc())
        .limit(100)
    )
    keywords = result.scalars().all()
    items = [
        MissedKeywordItem.model_validate(k).model_dump(mode="json")
        for k in keywords
    ]
    return APIResponse(data=items)


@router.delete("/missed-keywords/{keyword_id}", response_model=APIResponse)
async def delete_missed_keyword(
    keyword_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    """Mark a missed keyword as resolved (soft-delete)."""
    result = await db.execute(
        select(MissedKeyword).where(MissedKeyword.id == keyword_id)
    )
    keyword = result.scalar_one_or_none()
    if keyword is None:
        raise HTTPException(status_code=404, detail="Keyword not found")

    keyword.is_resolved = True
    keyword.updated_at = datetime.now(timezone.utc)
    return APIResponse(message="Keyword marked as resolved")
