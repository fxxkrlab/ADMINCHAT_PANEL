"""
Pydantic schemas for FAQ API endpoints.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---- FAQ Question ----

class FAQQuestionCreate(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=500)
    match_mode: str = Field(default="contains", pattern="^(exact|prefix|contains|regex)$")


class FAQQuestionUpdate(BaseModel):
    keyword: Optional[str] = Field(None, min_length=1, max_length=500)
    match_mode: Optional[str] = Field(None, pattern="^(exact|prefix|contains|regex)$")
    is_active: Optional[bool] = None


class FAQQuestionResponse(BaseModel):
    id: int
    keyword: str
    match_mode: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---- FAQ Answer ----

class FAQAnswerCreate(BaseModel):
    content: str = Field(..., min_length=1)
    content_type: str = Field(default="text", pattern="^(text|photo|mixed)$")
    media_file_id: Optional[str] = None


class FAQAnswerUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=1)
    content_type: Optional[str] = Field(None, pattern="^(text|photo|mixed)$")
    media_file_id: Optional[str] = None
    is_active: Optional[bool] = None


class FAQAnswerResponse(BaseModel):
    id: int
    content: str
    content_type: str
    media_file_id: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---- FAQ Rule ----

class FAQRuleCreate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    question_ids: List[int] = Field(default_factory=list)
    answer_ids: List[int] = Field(default_factory=list)
    response_mode: str = Field(
        default="single", pattern="^(single|random|all)$"
    )
    reply_mode: str = Field(
        default="direct",
        pattern="^(direct|ai_only|ai_polish|ai_fallback|ai_intent|ai_template|rag|ai_classify_and_answer)$",
    )
    ai_config: Dict[str, Any] = Field(default_factory=dict)
    priority: int = Field(default=0, ge=0)
    daily_ai_limit: Optional[int] = Field(None, ge=0)
    is_active: bool = True


class FAQRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    question_ids: Optional[List[int]] = None
    answer_ids: Optional[List[int]] = None
    response_mode: Optional[str] = Field(
        None, pattern="^(single|random|all)$"
    )
    reply_mode: Optional[str] = Field(
        None,
        pattern="^(direct|ai_only|ai_polish|ai_fallback|ai_intent|ai_template|rag|ai_classify_and_answer)$",
    )
    ai_config: Optional[Dict[str, Any]] = None
    priority: Optional[int] = Field(None, ge=0)
    daily_ai_limit: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class FAQRuleResponse(BaseModel):
    id: int
    name: Optional[str] = None
    response_mode: str
    reply_mode: str
    ai_config: Dict[str, Any] = {}
    priority: int = 0
    daily_ai_limit: Optional[int] = None
    is_active: bool
    questions: List[FAQQuestionResponse] = []
    answers: List[FAQAnswerResponse] = []
    hit_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---- FAQ Ranking ----

class FAQRankingItem(BaseModel):
    rule_id: int
    rule_name: Optional[str] = None
    hit_count: int
    last_hit_at: Optional[datetime] = None


# ---- Missed Keywords ----

class MissedKeywordItem(BaseModel):
    id: int
    keyword: str
    occurrence_count: int
    sample_messages: Optional[List[str]] = None
    is_resolved: bool
    last_seen_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}
