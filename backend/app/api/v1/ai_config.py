"""
AI Configuration API endpoints.

GET    /ai/configs        - list AI configurations
POST   /ai/configs        - create config
PATCH  /ai/configs/:id    - update config
DELETE /ai/configs/:id    - delete config
POST   /ai/configs/:id/test - test connection
GET    /ai/usage          - usage statistics
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin, require_super_admin
from app.faq.ai_handler import AIConfig as AIRuntimeConfig
from app.faq.ai_handler import ai_handler
from app.models.admin import Admin
from app.models.ai_config import AiConfig, AiUsageLog
from app.schemas.ai_config import (
    AIConfigCreate,
    AIConfigListResponse,
    AIConfigResponse,
    AIConfigTestRequest,
    AIConfigTestResponse,
    AIConfigUpdate,
    AIUsageStatsResponse,
)
from app.schemas.common import APIResponse

logger = logging.getLogger(__name__)

router = APIRouter()


def _mask_api_key(key: str) -> str:
    """Mask API key showing only last 4 characters."""
    if len(key) <= 4:
        return "****"
    return "*" * (len(key) - 4) + key[-4:]


def _config_to_response(config: AiConfig) -> AIConfigResponse:
    return AIConfigResponse(
        id=config.id,
        name=config.name,
        provider=config.provider,
        base_url=config.base_url,
        api_key_masked=_mask_api_key(config.api_key),
        model=config.model,
        default_params=config.default_params or {},
        is_active=config.is_active,
        created_at=config.created_at,
        updated_at=config.updated_at,
    )


@router.get("/configs", response_model=APIResponse)
async def list_ai_configs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_super_admin)],
) -> APIResponse:
    """List all AI configurations. Requires super_admin."""
    result = await db.execute(
        select(AiConfig).order_by(AiConfig.created_at.asc())
    )
    configs = result.scalars().all()

    count_result = await db.execute(select(func.count(AiConfig.id)))
    total = count_result.scalar_one()

    return APIResponse(
        data=AIConfigListResponse(
            items=[_config_to_response(c) for c in configs],
            total=total,
        ).model_dump()
    )


@router.post("/configs", response_model=APIResponse, status_code=status.HTTP_201_CREATED)
async def create_ai_config(
    body: AIConfigCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_super_admin)],
) -> APIResponse:
    """Create a new AI configuration. Requires super_admin."""
    config = AiConfig(
        name=body.name,
        provider=body.provider,
        base_url=body.base_url,
        api_key=body.api_key,  # TODO: encrypt before storing
        model=body.model,
        default_params=body.default_params,
        is_active=body.is_active,
    )
    db.add(config)
    await db.flush()
    await db.refresh(config)

    return APIResponse(
        code=201,
        message="AI config created successfully",
        data=_config_to_response(config).model_dump(),
    )


@router.patch("/configs/{config_id}", response_model=APIResponse)
async def update_ai_config(
    config_id: int,
    body: AIConfigUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_super_admin)],
) -> APIResponse:
    """Update an AI configuration. Requires super_admin."""
    result = await db.execute(select(AiConfig).where(AiConfig.id == config_id))
    config = result.scalar_one_or_none()

    if config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI config not found",
        )

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)

    await db.flush()
    await db.refresh(config)

    return APIResponse(
        message="AI config updated successfully",
        data=_config_to_response(config).model_dump(),
    )


@router.delete("/configs/{config_id}", response_model=APIResponse)
async def delete_ai_config(
    config_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_super_admin)],
) -> APIResponse:
    """Delete an AI configuration. Requires super_admin."""
    result = await db.execute(select(AiConfig).where(AiConfig.id == config_id))
    config = result.scalar_one_or_none()

    if config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI config not found",
        )

    await db.delete(config)
    await db.flush()

    return APIResponse(message="AI config deleted")


@router.post("/configs/{config_id}/test", response_model=APIResponse)
async def test_ai_config(
    config_id: int,
    body: AIConfigTestRequest | None = None,
    db: AsyncSession = Depends(get_db),
    _current_user: Admin = Depends(require_super_admin),
) -> APIResponse:
    """Test an AI configuration by calling the API with a simple prompt."""
    result = await db.execute(select(AiConfig).where(AiConfig.id == config_id))
    config = result.scalar_one_or_none()

    if config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI config not found",
        )

    runtime_config = AIRuntimeConfig(
        base_url=config.base_url,
        api_key=config.api_key,
        model=config.model or "gpt-3.5-turbo",
        max_tokens=config.default_params.get("max_tokens", 100),
        temperature=config.default_params.get("temperature", 0.7),
    )

    try:
        ai_resp = await ai_handler.test_connection(runtime_config)
        test_result = AIConfigTestResponse(
            success=True,
            response_text=ai_resp.content[:500],
            latency_ms=ai_resp.latency_ms,
            tokens_used=ai_resp.tokens_used,
        )
    except Exception as exc:
        logger.exception("AI config test failed for config %s", config_id)
        test_result = AIConfigTestResponse(
            success=False,
            error=str(exc)[:500],
        )

    return APIResponse(data=test_result.model_dump())


@router.get("/usage", response_model=APIResponse)
async def get_ai_usage(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
    days: int = 30,
) -> APIResponse:
    """Get AI usage statistics. Requires admin+."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Total stats
    total_result = await db.execute(
        select(
            func.count(AiUsageLog.id),
            func.coalesce(func.sum(AiUsageLog.tokens_used), 0),
            func.coalesce(func.sum(AiUsageLog.cost_estimate), 0),
        ).where(AiUsageLog.created_at >= cutoff)
    )
    row = total_result.one()
    total_requests = row[0]
    total_tokens = int(row[1])
    total_cost = float(row[2])

    # Daily stats
    daily_result = await db.execute(
        select(
            func.date_trunc("day", AiUsageLog.created_at).label("day"),
            func.count(AiUsageLog.id).label("requests"),
            func.coalesce(func.sum(AiUsageLog.tokens_used), 0).label("tokens"),
            func.coalesce(func.sum(AiUsageLog.cost_estimate), 0).label("cost"),
        )
        .where(AiUsageLog.created_at >= cutoff)
        .group_by("day")
        .order_by("day")
    )
    daily_stats = [
        {
            "date": str(r.day.date()) if r.day else "",
            "requests": r.requests,
            "tokens": int(r.tokens),
            "cost": float(r.cost),
        }
        for r in daily_result.all()
    ]

    # Per-config stats
    config_result = await db.execute(
        select(
            AiUsageLog.ai_config_id,
            AiConfig.name,
            func.count(AiUsageLog.id).label("requests"),
            func.coalesce(func.sum(AiUsageLog.tokens_used), 0).label("tokens"),
            func.coalesce(func.sum(AiUsageLog.cost_estimate), 0).label("cost"),
        )
        .outerjoin(AiConfig, AiUsageLog.ai_config_id == AiConfig.id)
        .where(AiUsageLog.created_at >= cutoff)
        .group_by(AiUsageLog.ai_config_id, AiConfig.name)
    )
    per_config = [
        {
            "config_id": r.ai_config_id,
            "config_name": r.name or "Unknown",
            "requests": r.requests,
            "tokens": int(r.tokens),
            "cost": float(r.cost),
        }
        for r in config_result.all()
    ]

    usage = AIUsageStatsResponse(
        total_requests=total_requests,
        total_tokens=total_tokens,
        total_cost=total_cost,
        daily_stats=daily_stats,
        per_config_stats=per_config,
    )

    return APIResponse(data=usage.model_dump())
