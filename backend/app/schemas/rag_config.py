"""
Pydantic schemas for RAG Config API endpoints.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class RagConfigCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    provider: Literal["dify"]
    base_url: str = Field(..., min_length=1, max_length=500)
    api_key: str = Field(..., min_length=1, max_length=500)
    dataset_id: str = Field(..., min_length=1, max_length=200)
    top_k: int = Field(default=3, ge=1, le=20)


class RagConfigUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    provider: Optional[Literal["dify"]] = None
    base_url: Optional[str] = Field(None, min_length=1, max_length=500)
    api_key: Optional[str] = Field(None, min_length=1, max_length=500)
    dataset_id: Optional[str] = Field(None, min_length=1, max_length=200)
    top_k: Optional[int] = Field(None, ge=1, le=20)
    is_active: Optional[bool] = None


class RagConfigResponse(BaseModel):
    id: int
    name: str
    provider: str
    base_url: str
    api_key_masked: str = ""
    dataset_id: str
    top_k: int = 3
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RagConfigListResponse(BaseModel):
    items: List[RagConfigResponse] = Field(default_factory=list)
    total: int = 0


class RagConfigTestResponse(BaseModel):
    success: bool
    result_count: int = 0
    error: Optional[str] = None
