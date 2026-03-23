"""
Pydantic schemas for FAQ API endpoints.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

# Shared type aliases
ReplyModeType = Literal[
    "direct", "ai_only", "ai_polish", "ai_fallback",
    "ai_intent", "ai_template", "rag", "ai_classify_and_answer",
]
ResponseModeType = Literal["single", "random", "all"]
MatchModeType = Literal["exact", "prefix", "contains", "regex", "catch_all"]


# ---- FAQ Question ----

class FAQQuestionCreate(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=500)
    match_mode: MatchModeType = "contains"


class FAQQuestionUpdate(BaseModel):
    keyword: Optional[str] = Field(None, min_length=1, max_length=500)
    match_mode: Optional[MatchModeType] = None
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
    question_ids: List[int] = Field(default_factory=list, min_length=0)
    answer_ids: List[int] = Field(default_factory=list, min_length=0)
    response_mode: ResponseModeType = "single"
    reply_mode: ReplyModeType = "direct"
    ai_config: Dict[str, Any] = Field(default_factory=dict)
    priority: int = Field(default=0, ge=0)
    daily_ai_limit: Optional[int] = Field(None, ge=0)
    category_id: Optional[int] = None
    rag_config_id: Optional[int] = None
    is_active: bool = True


class FAQRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    question_ids: Optional[List[int]] = None
    answer_ids: Optional[List[int]] = None
    response_mode: Optional[ResponseModeType] = None
    reply_mode: Optional[ReplyModeType] = None
    ai_config: Optional[Dict[str, Any]] = None
    priority: Optional[int] = Field(None, ge=0)
    daily_ai_limit: Optional[int] = Field(None, ge=0)
    category_id: Optional[int] = None
    rag_config_id: Optional[int] = None
    is_active: Optional[bool] = None


class FAQRuleResponse(BaseModel):
    id: int
    name: Optional[str] = None
    response_mode: str
    reply_mode: str
    ai_config: Dict[str, Any] = Field(default_factory=dict)
    priority: int = 0
    daily_ai_limit: Optional[int] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    faq_group_id: Optional[int] = None
    faq_group_name: Optional[str] = None
    rag_config_id: Optional[int] = None
    is_active: bool
    questions: List[FAQQuestionResponse] = Field(default_factory=list)
    answers: List[FAQAnswerResponse] = Field(default_factory=list)
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


# ---- Missed Keyword Filters ----

class MissedKeywordFilterCreate(BaseModel):
    pattern: str = Field(..., min_length=1, max_length=500)
    match_mode: str = Field(default="exact", pattern="^(exact|prefix|contains|regex)$")
    description: Optional[str] = None


class MissedKeywordFilterResponse(BaseModel):
    id: int
    pattern: str
    match_mode: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
