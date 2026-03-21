"""
Audit logging service.

Logs admin actions to the audit_logs table for compliance and debugging.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog

logger = logging.getLogger(__name__)


async def log_action(
    db: AsyncSession,
    admin_id: Optional[int],
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """
    Create an audit log entry.

    Args:
        db: Async database session.
        admin_id: ID of the admin performing the action.
        action: Action name (e.g. 'create_bot', 'update_settings', 'login').
        target_type: Type of the target entity (e.g. 'bot', 'admin', 'faq_rule').
        target_id: ID of the target entity.
        details: Additional details as a JSON dict.
        ip_address: IP address of the request.

    Returns:
        The created AuditLog entry.
    """
    entry = AuditLog(
        admin_id=admin_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details or {},
        ip_address=ip_address,
    )
    db.add(entry)
    await db.flush()

    logger.info(
        "Audit: admin=%s action=%s target=%s/%s",
        admin_id,
        action,
        target_type,
        target_id,
    )

    return entry


async def get_audit_logs(
    db: AsyncSession,
    admin_id: Optional[int] = None,
    action: Optional[str] = None,
    target_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[AuditLog]:
    """
    Query audit logs with optional filters.
    """
    from sqlalchemy import select

    query = select(AuditLog).order_by(AuditLog.created_at.desc())

    if admin_id is not None:
        query = query.where(AuditLog.admin_id == admin_id)
    if action is not None:
        query = query.where(AuditLog.action == action)
    if target_type is not None:
        query = query.where(AuditLog.target_type == target_type)

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())
