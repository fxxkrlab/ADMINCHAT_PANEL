"""
Audit Log API endpoints.

GET /audit-logs - list audit logs with filtering and pagination (super_admin only)
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.api.deps import get_db, require_super_admin
from app.models.admin import Admin
from app.models.audit import AuditLog
from app.schemas.audit import AuditLogListResponse, AuditLogOut
from app.schemas.common import APIResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=APIResponse)
async def list_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_super_admin)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    admin_id: Optional[int] = Query(default=None),
    action: Optional[str] = Query(default=None),
    target_type: Optional[str] = Query(default=None),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
) -> APIResponse:
    """
    List audit logs with optional filtering and pagination.
    Super admin only.
    """
    base_query = select(AuditLog).options(joinedload(AuditLog.admin))

    if admin_id is not None:
        base_query = base_query.where(AuditLog.admin_id == admin_id)
    if action is not None:
        base_query = base_query.where(AuditLog.action == action)
    if target_type is not None:
        base_query = base_query.where(AuditLog.target_type == target_type)
    if date_from is not None:
        base_query = base_query.where(AuditLog.created_at >= date_from)
    if date_to is not None:
        base_query = base_query.where(AuditLog.created_at <= date_to)

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    offset = (page - 1) * page_size
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    items_query = (
        base_query
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(items_query)
    logs = result.scalars().unique().all()

    items = []
    for log in logs:
        item = AuditLogOut.model_validate(log)
        if log.admin:
            item.admin_username = log.admin.username
        items.append(item)

    return APIResponse(
        data=AuditLogListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        ).model_dump(mode="json")
    )
