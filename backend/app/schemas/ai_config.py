"""
Pydantic schemas for AI Config API endpoints.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---- Request schemas ----

class AIConfigCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    provider: str = Field(..., pattern=r"^(openai|anthropic|custom)$")
    base_url: str = Field(..., min_length=1, max_length=500)
    api_key: str = Field(..., min_length=1, max_length=500)
    model: Optional[str] = Field(None, max_length=100)
    api_format: str = Field(default="openai_chat", pattern=r"^(openai_chat|anthropic_responses)$")
    default_params: Dict[str, Any] = Field(default_factory=lambda: {
        "temperature": 0.7,
        "max_tokens": 500,
    })
    is_active: bool = True


class AIConfigUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    provider: Optional[str] = Field(None, pattern=r"^(openai|anthropic|custom)$")
    base_url: Optional[str] = Field(None, min_length=1, max_length=500)
    api_key: Optional[str] = Field(None, min_length=1, max_length=500)
    model: Optional[str] = Field(None, max_length=100)
    api_format: Optional[str] = Field(None, pattern=r"^(openai_chat|anthropic_responses)$")
    default_params: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class AIConfigTestRequest(BaseModel):
    """Optional override params for test connection."""
    prompt: Optional[str] = Field(None, max_length=500)


# ---- Response schemas ----

class AIConfigResponse(BaseModel):
    id: int
    name: str
    provider: str
    base_url: str
    api_key_masked: str = ""  # Only show last 4 chars
    model: Optional[str] = None
    api_format: str = "openai_chat"
    default_params: Dict[str, Any] = {}
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AIConfigListResponse(BaseModel):
    items: List[AIConfigResponse] = []
    total: int = 0


class AIConfigTestResponse(BaseModel):
    success: bool
    response_text: Optional[str] = None
    latency_ms: float = 0.0
    tokens_used: int = 0
    error: Optional[str] = None


class AIUsageStatsResponse(BaseModel):
    total_requests: int = 0
    total_tokens: int = 0
    total_cost: float = 0.0
    daily_stats: List[Dict[str, Any]] = []
    per_config_stats: List[Dict[str, Any]] = []
