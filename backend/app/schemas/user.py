from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# === Tag schemas ===
class TagOut(BaseModel):
    id: int
    name: str
    color: str

    model_config = {"from_attributes": True}


class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    color: str = Field(default="#3B82F6", pattern=r"^#[0-9A-Fa-f]{6}$")


# === UserGroup schemas ===
class UserGroupOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    member_count: int = 0

    model_config = {"from_attributes": True}


class UserGroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class AddUserToGroupRequest(BaseModel):
    group_id: int


# === User schemas ===
class UserListItem(BaseModel):
    id: int
    tg_uid: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_premium: bool = False
    dc_id: Optional[int] = None
    phone_region: Optional[str] = None
    is_blocked: bool = False
    tags: List[TagOut] = []
    message_count: int = 0
    last_active_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ConversationBrief(BaseModel):
    id: int
    source_type: str
    status: str
    last_message_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserDetail(BaseModel):
    id: int
    tg_uid: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    language_code: Optional[str] = None
    is_premium: bool = False
    dc_id: Optional[int] = None
    phone_region: Optional[str] = None
    is_blocked: bool = False
    block_reason: Optional[str] = None
    tags: List[TagOut] = []
    groups: List[UserGroupOut] = []
    turnstile_verified: bool = False
    turnstile_expires_at: Optional[datetime] = None
    first_seen_at: Optional[datetime] = None
    last_active_at: Optional[datetime] = None
    total_messages: int = 0
    conversations_count: int = 0
    conversations: List[ConversationBrief] = []

    model_config = {"from_attributes": True}


class BlockRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


class AddTagRequest(BaseModel):
    tag_id: int
