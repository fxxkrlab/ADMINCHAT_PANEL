from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AdminBase(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    display_name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=255)
    role: str = Field(default="agent", pattern=r"^(super_admin|admin|agent)$")


class AdminCreate(AdminBase):
    password: str = Field(..., min_length=6, max_length=128)


class AdminUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=255)
    role: Optional[str] = Field(None, pattern=r"^(super_admin|admin|agent)$")
    password: Optional[str] = Field(None, min_length=6, max_length=128)
    is_active: Optional[bool] = None


class AdminPermissionsUpdate(BaseModel):
    permissions: Dict[str, Any] = Field(default_factory=dict)


class AdminResponse(BaseModel):
    id: int
    username: str
    display_name: Optional[str] = None
    email: Optional[str] = None
    role: str
    is_active: bool
    permissions: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AdminListResponse(BaseModel):
    items: List[AdminResponse] = []
    total: int = 0
