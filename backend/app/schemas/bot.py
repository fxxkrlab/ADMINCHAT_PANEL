"""
Pydantic schemas for Bot API endpoints.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---- Request schemas ----

class BotCreate(BaseModel):
    token: str = Field(..., min_length=30, description="Telegram bot token")
    display_name: Optional[str] = Field(None, max_length=100)
    priority: int = Field(default=0, ge=0)


class BotUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None
    priority: Optional[int] = Field(None, ge=0)


# ---- Response schemas ----

class BotResponse(BaseModel):
    id: int
    bot_id: Optional[int] = None
    bot_username: Optional[str] = None
    display_name: Optional[str] = None
    is_active: bool
    is_rate_limited: bool = False
    rate_limit_until: Optional[datetime] = None
    priority: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BotStatusResponse(BaseModel):
    id: int
    bot_username: Optional[str] = None
    is_active: bool
    is_online: bool = False
    is_rate_limited: bool = False
    rate_limit_until: Optional[datetime] = None
    messages_today: int = 0
    last_send_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BotListResponse(BaseModel):
    items: list[BotResponse] = []
    total: int = 0
