"""
Pydantic schemas for Audit Log API endpoints.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AuditLogOut(BaseModel):
    id: int
    admin_id: Optional[int] = None
    admin_username: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    details: Dict[str, Any] = {}
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    items: List[AuditLogOut] = []
    total: int = 0
    page: int = 1
    page_size: int = 20
    total_pages: int = 0
