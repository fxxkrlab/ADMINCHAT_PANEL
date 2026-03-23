from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class TagOut(BaseModel):
    id: int
    name: str
    color: str

    model_config = {"from_attributes": True}


class UserBrief(BaseModel):
    id: int
    tg_uid: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_premium: bool = False
    dc_id: Optional[int] = None
    phone_region: Optional[str] = None
    is_blocked: bool = False
    photo_url: Optional[str] = None
    tags: List[TagOut] = []

    model_config = {"from_attributes": True}


class SourceGroupBrief(BaseModel):
    id: int
    title: Optional[str] = None
    tg_chat_id: int

    model_config = {"from_attributes": True}


class BotBrief(BaseModel):
    id: int
    bot_username: Optional[str] = None
    display_name: Optional[str] = None

    model_config = {"from_attributes": True}


class LastMessagePreview(BaseModel):
    id: int
    text_content: Optional[str] = None
    content_type: str = "text"
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminBrief(BaseModel):
    id: int
    username: str
    display_name: Optional[str] = None

    model_config = {"from_attributes": True}


class ConversationListItem(BaseModel):
    id: int
    user: UserBrief
    source_type: str
    source_group: Optional[SourceGroupBrief] = None
    status: str
    assigned_to: Optional[int] = None
    assigned_admin: Optional[AdminBrief] = None
    primary_bot: Optional[BotBrief] = None
    last_message: Optional[LastMessagePreview] = None
    unread_count: int = 0
    last_message_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationDetail(BaseModel):
    id: int
    user: UserBrief
    source_type: str
    source_group: Optional[SourceGroupBrief] = None
    status: str
    assigned_to: Optional[int] = None
    assigned_admin: Optional[AdminBrief] = None
    primary_bot: Optional[BotBrief] = None
    unread_count: int = 0
    last_message_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationStatusUpdate(BaseModel):
    status: Literal["open", "resolved", "blocked"]


class ConversationAssign(BaseModel):
    assigned_to: Optional[int] = None  # admin id, null to unassign
