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
GET    /faq/missed-keyword-filters    - list keyword filters
POST   /faq/missed-keyword-filters    - create keyword filter
DELETE /faq/missed-keyword-filters/:id - delete keyword filter
GET    /faq/groups             - list FAQ groups
POST   /faq/groups             - create FAQ group
PATCH  /faq/groups/:id         - update FAQ group
DELETE /faq/groups/:id         - delete FAQ group
GET    /faq/categories         - list FAQ categories
POST   /faq/categories         - create FAQ category
PATCH  /faq/categories/:id     - update FAQ category
DELETE /faq/categories/:id     - delete FAQ category
"""
from __future__ import annotations

import logging
import re
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
    FaqCategory,
    FaqGroup,
    FaqQuestion,
    FaqRule,
    FaqRuleAnswer,
    FaqRuleQuestion,
)
from app.models.stats import FaqHitStat, MissedKeyword, MissedKeywordFilter
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
    MissedKeywordFilterCreate,
    MissedKeywordFilterResponse,
    MissedKeywordItem,
)
from app.utils.keyword_filter import keyword_matches_filter
from app.schemas.faq_group import (
    FAQCategoryCreate,
    FAQCategoryResponse,
    FAQCategoryUpdate,
    FAQGroupCreate,
    FAQGroupResponse,
    FAQGroupUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _build_rule_response(rule: FaqRule, total_hits: int = 0) -> dict:
    """Build FAQRuleResponse dict from an ORM rule with eager-loaded relations."""
    category_name = None
    faq_group_id = None
    faq_group_name = None
    if rule.category:
        category_name = rule.category.name
        if rule.category.faq_group:
            faq_group_id = rule.category.faq_group_id
            faq_group_name = rule.category.faq_group.name

    return FAQRuleResponse(
        id=rule.id,
        name=rule.name,
        response_mode=rule.response_mode,
        reply_mode=rule.reply_mode,
        ai_config=rule.ai_config or {},
        priority=rule.priority,
        daily_ai_limit=rule.daily_ai_limit,
        category_id=rule.category_id,
        category_name=category_name,
        faq_group_id=faq_group_id,
        faq_group_name=faq_group_name,
        rag_config_id=rule.rag_config_id,
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
    ).model_dump(mode="json")


def _rule_query_options():
    """Standard selectinload options for FaqRule queries."""
    return [
        selectinload(FaqRule.rule_questions).selectinload(FaqRuleQuestion.question),
        selectinload(FaqRule.rule_answers).selectinload(FaqRuleAnswer.answer),
        selectinload(FaqRule.category).selectinload(FaqCategory.faq_group),
    ]


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
    category_id: Optional[int] = Query(None),
    group_id: Optional[int] = Query(None),
):
    """List all FAQ rules with associated questions and answers."""
    stmt = (
        select(FaqRule)
        .options(*_rule_query_options())
        .order_by(FaqRule.priority.desc(), FaqRule.id.desc())
    )

    if reply_mode is not None:
        stmt = stmt.where(FaqRule.reply_mode == reply_mode)
    if is_active is not None:
        stmt = stmt.where(FaqRule.is_active == is_active)
    if category_id is not None:
        stmt = stmt.where(FaqRule.category_id == category_id)
    if group_id is not None:
        stmt = stmt.join(FaqCategory, FaqRule.category_id == FaqCategory.id).where(
            FaqCategory.faq_group_id == group_id
        )

    result = await db.execute(stmt)
    rules = result.scalars().unique().all()

    # Batch query: hit counts for all rules in one query
    rule_ids = [r.id for r in rules]
    hit_map: dict[int, int] = {rid: 0 for rid in rule_ids}
    if rule_ids:
        hit_result = await db.execute(
            select(
                FaqHitStat.faq_rule_id,
                func.coalesce(func.sum(FaqHitStat.hit_count), 0).label("total"),
            )
            .where(FaqHitStat.faq_rule_id.in_(rule_ids))
            .group_by(FaqHitStat.faq_rule_id)
        )
        for row in hit_result.all():
            hit_map[row.faq_rule_id] = row.total

    items = [_build_rule_response(rule, hit_map.get(rule.id, 0)) for rule in rules]

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
    # Validate category_id if provided
    if body.category_id is not None:
        cat_result = await db.execute(
            select(FaqCategory).where(FaqCategory.id == body.category_id)
        )
        if cat_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="Category not found")

    rule = FaqRule(
        name=body.name,
        response_mode=body.response_mode,
        reply_mode=body.reply_mode,
        ai_config=body.ai_config,
        priority=body.priority,
        daily_ai_limit=body.daily_ai_limit,
        category_id=body.category_id,
        rag_config_id=body.rag_config_id,
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
    result = await db.execute(
        select(FaqRule).where(FaqRule.id == rule.id).options(*_rule_query_options())
    )
    rule = result.scalar_one()

    await log_action(
        db, _current_user.id, "create_faq_rule", "faq_rule", rule.id,
        {"name": rule.name},
        request.client.host if request.client else None,
    )

    return APIResponse(
        code=201,
        message="Rule created",
        data=_build_rule_response(rule),
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

    # Validate category_id if provided
    if "category_id" in update_data and update_data["category_id"] is not None:
        cat_result = await db.execute(
            select(FaqCategory).where(FaqCategory.id == update_data["category_id"])
        )
        if cat_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="Category not found")

    # Handle question_ids reassociation
    if "question_ids" in update_data:
        question_ids = update_data.pop("question_ids")
        await db.execute(
            delete(FaqRuleQuestion).where(FaqRuleQuestion.rule_id == rule.id)
        )
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
    result = await db.execute(
        select(FaqRule).where(FaqRule.id == rule.id).options(*_rule_query_options())
    )
    rule = result.scalar_one()

    hit_result = await db.execute(
        select(func.coalesce(func.sum(FaqHitStat.hit_count), 0)).where(
            FaqHitStat.faq_rule_id == rule.id
        )
    )
    total_hits = hit_result.scalar() or 0

    await log_action(
        db, _current_user.id, "update_faq_rule", "faq_rule", rule_id,
        {"name": rule.name},
        request.client.host if request.client else None,
    )

    return APIResponse(data=_build_rule_response(rule, total_hits))


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


# ============================================================
# Missed Keyword Filters
# ============================================================

@router.get("/missed-keyword-filters", response_model=APIResponse)
async def list_missed_keyword_filters(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    """List all missed keyword filters."""
    result = await db.execute(
        select(MissedKeywordFilter).order_by(MissedKeywordFilter.created_at.desc())
    )
    filters = result.scalars().all()
    items = [
        MissedKeywordFilterResponse.model_validate(f).model_dump(mode="json")
        for f in filters
    ]
    return APIResponse(data=items)


@router.post(
    "/missed-keyword-filters",
    response_model=APIResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_missed_keyword_filter(
    body: MissedKeywordFilterCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    """Create a new missed keyword filter and auto-resolve matching keywords."""
    # Validate regex pattern
    if body.match_mode == "regex":
        try:
            re.compile(body.pattern)
        except re.error as e:
            raise HTTPException(
                status_code=400, detail=f"Invalid regex pattern: {e}"
            )

    new_filter = MissedKeywordFilter(
        pattern=body.pattern,
        match_mode=body.match_mode,
        description=body.description,
    )
    db.add(new_filter)
    await db.flush()
    await db.refresh(new_filter)

    # Auto-resolve existing matching missed keywords
    result = await db.execute(
        select(MissedKeyword).where(MissedKeyword.is_resolved.is_(False))
    )
    unresolved = result.scalars().all()
    resolved_count = 0
    now = datetime.now(timezone.utc)
    for kw in unresolved:
        if keyword_matches_filter(kw.keyword, body.pattern, body.match_mode):
            kw.is_resolved = True
            kw.updated_at = now
            resolved_count += 1

    logger.info(
        "Filter '%s' (%s) auto-resolved %d missed keywords.",
        body.pattern, body.match_mode, resolved_count,
    )

    return APIResponse(
        code=201,
        message=f"Filter created, {resolved_count} keywords auto-resolved",
        data=MissedKeywordFilterResponse.model_validate(new_filter).model_dump(mode="json"),
    )


@router.delete("/missed-keyword-filters/{filter_id}", response_model=APIResponse)
async def delete_missed_keyword_filter(
    filter_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    """Delete a missed keyword filter."""
    result = await db.execute(
        select(MissedKeywordFilter).where(MissedKeywordFilter.id == filter_id)
    )
    f = result.scalar_one_or_none()
    if f is None:
        raise HTTPException(status_code=404, detail="Filter not found")

    await db.delete(f)
    return APIResponse(message="Filter deleted")


# ============================================================
# FAQ Groups
# ============================================================

async def _build_group_response(group: FaqGroup, db: AsyncSession) -> dict:
    categories = []
    for cat in (group.categories or []):
        rule_count_result = await db.execute(
            select(func.count(FaqRule.id)).where(FaqRule.category_id == cat.id)
        )
        rule_count = rule_count_result.scalar() or 0
        categories.append(FAQCategoryResponse(
            id=cat.id,
            name=cat.name,
            faq_group_id=cat.faq_group_id,
            bot_group_id=cat.bot_group_id,
            bot_group_name=cat.bot_group.name if cat.bot_group else None,
            is_active=cat.is_active,
            rule_count=rule_count,
            created_at=cat.created_at,
            updated_at=cat.updated_at,
        ))
    return FAQGroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        bot_group_id=group.bot_group_id,
        bot_group_name=group.bot_group.name if group.bot_group else None,
        is_active=group.is_active,
        categories=categories,
        created_at=group.created_at,
        updated_at=group.updated_at,
    ).model_dump(mode="json")


@router.get("/groups", response_model=APIResponse)
async def list_faq_groups(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    """List all FAQ groups with their categories."""
    result = await db.execute(
        select(FaqGroup)
        .options(
            selectinload(FaqGroup.categories).selectinload(FaqCategory.bot_group),
            selectinload(FaqGroup.bot_group),
        )
        .order_by(FaqGroup.id.asc())
    )
    groups = result.scalars().unique().all()
    items = [await _build_group_response(g, db) for g in groups]
    return APIResponse(data=items)


@router.post("/groups", response_model=APIResponse, status_code=status.HTTP_201_CREATED)
async def create_faq_group(
    body: FAQGroupCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    group = FaqGroup(
        name=body.name,
        description=body.description,
        bot_group_id=body.bot_group_id,
        is_active=body.is_active,
    )
    db.add(group)
    await db.flush()

    # Reload with relationships
    result = await db.execute(
        select(FaqGroup).where(FaqGroup.id == group.id)
        .options(
            selectinload(FaqGroup.categories).selectinload(FaqCategory.bot_group),
            selectinload(FaqGroup.bot_group),
        )
    )
    group = result.scalar_one()

    await log_action(
        db, _current_user.id, "create_faq_group", "faq_group", group.id,
        {"name": group.name},
        request.client.host if request.client else None,
    )
    return APIResponse(code=201, message="FAQ group created", data=await _build_group_response(group, db))


@router.patch("/groups/{group_id}", response_model=APIResponse)
async def update_faq_group(
    group_id: int,
    body: FAQGroupUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    result = await db.execute(select(FaqGroup).where(FaqGroup.id == group_id))
    group = result.scalar_one_or_none()
    if group is None:
        raise HTTPException(status_code=404, detail="FAQ group not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(group, field, value)

    await db.flush()

    result = await db.execute(
        select(FaqGroup).where(FaqGroup.id == group_id)
        .options(
            selectinload(FaqGroup.categories).selectinload(FaqCategory.bot_group),
            selectinload(FaqGroup.bot_group),
        )
    )
    group = result.scalar_one()

    await log_action(
        db, _current_user.id, "update_faq_group", "faq_group", group_id,
        {"name": group.name},
        request.client.host if request.client else None,
    )
    return APIResponse(data=await _build_group_response(group, db))


@router.delete("/groups/{group_id}", response_model=APIResponse)
async def delete_faq_group(
    group_id: int,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    result = await db.execute(select(FaqGroup).where(FaqGroup.id == group_id))
    group = result.scalar_one_or_none()
    if group is None:
        raise HTTPException(status_code=404, detail="FAQ group not found")

    await log_action(
        db, _current_user.id, "delete_faq_group", "faq_group", group_id,
        {"name": group.name},
        request.client.host if request.client else None,
    )
    await db.delete(group)
    return APIResponse(message="FAQ group deleted")


# ============================================================
# FAQ Categories
# ============================================================

@router.get("/categories", response_model=APIResponse)
async def list_faq_categories(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
    group_id: Optional[int] = Query(None),
):
    """List all FAQ categories, optionally filtered by group_id."""
    stmt = (
        select(FaqCategory)
        .options(
            selectinload(FaqCategory.bot_group),
            selectinload(FaqCategory.faq_group),
        )
        .order_by(FaqCategory.faq_group_id.asc(), FaqCategory.id.asc())
    )
    if group_id is not None:
        stmt = stmt.where(FaqCategory.faq_group_id == group_id)

    result = await db.execute(stmt)
    categories = result.scalars().unique().all()

    # Count rules per category
    items = []
    for cat in categories:
        rule_count_result = await db.execute(
            select(func.count(FaqRule.id)).where(FaqRule.category_id == cat.id)
        )
        rule_count = rule_count_result.scalar() or 0
        items.append(FAQCategoryResponse(
            id=cat.id,
            name=cat.name,
            faq_group_id=cat.faq_group_id,
            bot_group_id=cat.bot_group_id,
            bot_group_name=cat.bot_group.name if cat.bot_group else None,
            is_active=cat.is_active,
            rule_count=rule_count,
            created_at=cat.created_at,
            updated_at=cat.updated_at,
        ).model_dump(mode="json"))

    return APIResponse(data=items)


@router.post("/categories", response_model=APIResponse, status_code=status.HTTP_201_CREATED)
async def create_faq_category(
    body: FAQCategoryCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    # Validate group exists
    grp_result = await db.execute(
        select(FaqGroup).where(FaqGroup.id == body.faq_group_id)
    )
    if grp_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=400, detail="FAQ group not found")

    cat = FaqCategory(
        name=body.name,
        faq_group_id=body.faq_group_id,
        bot_group_id=body.bot_group_id,
        is_active=body.is_active,
    )
    db.add(cat)
    await db.flush()

    # Reload
    result = await db.execute(
        select(FaqCategory).where(FaqCategory.id == cat.id)
        .options(selectinload(FaqCategory.bot_group), selectinload(FaqCategory.faq_group))
    )
    cat = result.scalar_one()

    await log_action(
        db, _current_user.id, "create_faq_category", "faq_category", cat.id,
        {"name": cat.name, "faq_group_id": cat.faq_group_id},
        request.client.host if request.client else None,
    )
    return APIResponse(
        code=201,
        message="FAQ category created",
        data=FAQCategoryResponse(
            id=cat.id,
            name=cat.name,
            faq_group_id=cat.faq_group_id,
            bot_group_id=cat.bot_group_id,
            bot_group_name=cat.bot_group.name if cat.bot_group else None,
            is_active=cat.is_active,
            created_at=cat.created_at,
            updated_at=cat.updated_at,
        ).model_dump(mode="json"),
    )


@router.patch("/categories/{category_id}", response_model=APIResponse)
async def update_faq_category(
    category_id: int,
    body: FAQCategoryUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    result = await db.execute(select(FaqCategory).where(FaqCategory.id == category_id))
    cat = result.scalar_one_or_none()
    if cat is None:
        raise HTTPException(status_code=404, detail="FAQ category not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(cat, field, value)

    await db.flush()

    result = await db.execute(
        select(FaqCategory).where(FaqCategory.id == category_id)
        .options(selectinload(FaqCategory.bot_group), selectinload(FaqCategory.faq_group))
    )
    cat = result.scalar_one()

    await log_action(
        db, _current_user.id, "update_faq_category", "faq_category", category_id,
        {"name": cat.name},
        request.client.host if request.client else None,
    )
    return APIResponse(
        data=FAQCategoryResponse(
            id=cat.id,
            name=cat.name,
            faq_group_id=cat.faq_group_id,
            bot_group_id=cat.bot_group_id,
            bot_group_name=cat.bot_group.name if cat.bot_group else None,
            is_active=cat.is_active,
            created_at=cat.created_at,
            updated_at=cat.updated_at,
        ).model_dump(mode="json"),
    )


@router.delete("/categories/{category_id}", response_model=APIResponse)
async def delete_faq_category(
    category_id: int,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    result = await db.execute(select(FaqCategory).where(FaqCategory.id == category_id))
    cat = result.scalar_one_or_none()
    if cat is None:
        raise HTTPException(status_code=404, detail="FAQ category not found")

    # Unlink rules from this category (set category_id = NULL)
    from sqlalchemy import update as sa_update
    await db.execute(
        sa_update(FaqRule).where(FaqRule.category_id == category_id).values(category_id=None)
    )

    await log_action(
        db, _current_user.id, "delete_faq_category", "faq_category", category_id,
        {"name": cat.name},
        request.client.host if request.client else None,
    )
    await db.delete(cat)
    return APIResponse(message="FAQ category deleted")
