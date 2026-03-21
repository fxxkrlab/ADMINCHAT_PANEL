"""
Pydantic schemas for System Settings API endpoints.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SettingItem(BaseModel):
    key: str
    value: Any
    description: Optional[str] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SettingsResponse(BaseModel):
    items: List[SettingItem] = []


class SettingsUpdate(BaseModel):
    """Batch update: dict of key -> value pairs."""
    settings: Dict[str, Any] = Field(..., min_length=1)


class TurnstileVerifyRequest(BaseModel):
    token: str = Field(..., min_length=1)
    tg_uid: int


class TurnstileVerifyResponse(BaseModel):
    success: bool
    message: str = ""
