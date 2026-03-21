"""
Bot management API endpoints.

GET    /bots           - list all bots with status
POST   /bots           - add new bot (validates token with TG API)
PATCH  /bots/:id       - update bot settings
DELETE /bots/:id       - remove bot
POST   /bots/:id/restart - restart specific bot
GET    /bots/:id/status  - get real-time status
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated

from aiogram import Bot as AiogramBot
from aiogram.exceptions import TelegramUnauthorizedError
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin, require_super_admin
from app.models.admin import Admin
from app.models.bot import Bot
from app.models.message import Message
from app.schemas.bot import (
    BotCreate,
    BotUpdate,
    BotResponse,
    BotStatusResponse,
    BotListResponse,
)
from app.schemas.common import APIResponse
from app.bot.manager import bot_manager
from app.bot.rate_limiter import is_rate_limited
from app.services.audit import log_action
from app.services.realtime import publish_bot_status

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=APIResponse)
async def list_bots(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    """List all bots with their current status."""
    result = await db.execute(
        select(Bot).order_by(Bot.priority.desc(), Bot.id)
    )
    bots = result.scalars().all()

    items = []
    for bot in bots:
        items.append(BotResponse.model_validate(bot))

    return APIResponse(
        data=BotListResponse(items=items, total=len(items)).model_dump()
    )


@router.post("", response_model=APIResponse, status_code=status.HTTP_201_CREATED)
async def create_bot(
    body: BotCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_super_admin)],
):
    """
    Add a new bot to the pool.
    Validates the token by calling Telegram getMe before saving.
    """
    # Check for duplicate token
    result = await db.execute(select(Bot).where(Bot.token == body.token))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bot with this token already exists",
        )

    # Validate token with Telegram
    temp_bot = None
    try:
        temp_bot = AiogramBot(token=body.token)
        me = await temp_bot.get_me()
    except TelegramUnauthorizedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid bot token: Telegram rejected it",
        )
    except Exception as exc:
        logger.exception("Failed to validate bot token")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to validate bot token: {exc}",
        )
    finally:
        if temp_bot:
            await temp_bot.session.close()

    # Save to DB
    bot_record = Bot(
        token=body.token,
        bot_username=me.username,
        bot_id=me.id,
        display_name=body.display_name or me.first_name,
        priority=body.priority,
        is_active=True,
    )
    db.add(bot_record)
    await db.flush()

    # Start the bot in BotManager
    try:
        await bot_manager.add_bot(bot_record.id, body.token)
    except Exception:
        logger.exception("Failed to start bot %s after creation", bot_record.id)
        # Still save to DB; admin can restart later

    await log_action(
        db, _current_user.id, "create_bot", "bot", bot_record.id,
        {"bot_username": bot_record.bot_username},
        request.client.host if request.client else None,
    )

    await db.commit()
    await db.refresh(bot_record)

    return APIResponse(
        code=201,
        message="Bot created and started",
        data=BotResponse.model_validate(bot_record).model_dump(),
    )


@router.patch("/{bot_id}", response_model=APIResponse)
async def update_bot(
    bot_id: int,
    body: BotUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_super_admin)],
):
    """Update bot settings (display_name, is_active, priority)."""
    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot_record = result.scalar_one_or_none()
    if bot_record is None:
        raise HTTPException(status_code=404, detail="Bot not found")

    update_data = body.model_dump(exclude_unset=True)
    was_active = bot_record.is_active

    for field, value in update_data.items():
        setattr(bot_record, field, value)

    await db.commit()
    await db.refresh(bot_record)

    # Handle activation / deactivation
    if "is_active" in update_data:
        if bot_record.is_active and not was_active:
            try:
                await bot_manager.add_bot(bot_record.id, bot_record.token)
            except Exception:
                logger.exception("Failed to activate bot %s", bot_id)
        elif not bot_record.is_active and was_active:
            await bot_manager.remove_bot(bot_record.id)

    return APIResponse(data=BotResponse.model_validate(bot_record).model_dump())


@router.delete("/{bot_id}", response_model=APIResponse)
async def delete_bot(
    bot_id: int,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_super_admin)],
):
    """Remove a bot from the pool entirely."""
    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot_record = result.scalar_one_or_none()
    if bot_record is None:
        raise HTTPException(status_code=404, detail="Bot not found")

    # Stop the bot
    await bot_manager.remove_bot(bot_id)

    await log_action(
        db, _current_user.id, "delete_bot", "bot", bot_id,
        {"bot_username": bot_record.bot_username},
        request.client.host if request.client else None,
    )

    await db.delete(bot_record)
    await db.commit()

    return APIResponse(message="Bot deleted")


@router.post("/{bot_id}/restart", response_model=APIResponse)
async def restart_bot(
    bot_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    """Restart a specific bot (stop + start)."""
    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot_record = result.scalar_one_or_none()
    if bot_record is None:
        raise HTTPException(status_code=404, detail="Bot not found")

    if not bot_record.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bot is not active",
        )

    try:
        # If bot is currently managed, restart it; otherwise, add it fresh
        if bot_id in bot_manager.active_bot_ids:
            await bot_manager.restart_bot(bot_id)
        else:
            await bot_manager.add_bot(bot_id, bot_record.token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to restart bot: {exc}",
        )

    return APIResponse(message="Bot restarted")


@router.get("/{bot_id}/status", response_model=APIResponse)
async def get_bot_status(
    bot_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[Admin, Depends(require_admin)],
):
    """Get real-time status of a specific bot."""
    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot_record = result.scalar_one_or_none()
    if bot_record is None:
        raise HTTPException(status_code=404, detail="Bot not found")

    # Is the bot actually running in BotManager?
    is_online = bot_id in bot_manager.active_bot_ids

    # Check rate limit from Redis
    rate_limited = await is_rate_limited(bot_id)

    # Count messages sent today by this bot
    today_start = datetime.utcnow().replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    msg_count_result = await db.execute(
        select(func.count(Message.id)).where(
            Message.via_bot_id == bot_id,
            Message.direction == "outbound",
            Message.created_at >= today_start,
        )
    )
    messages_today = msg_count_result.scalar() or 0

    # Last outbound message time
    last_send_result = await db.execute(
        select(Message.created_at)
        .where(
            Message.via_bot_id == bot_id,
            Message.direction == "outbound",
        )
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    last_send_row = last_send_result.first()
    last_send_at = last_send_row[0] if last_send_row else None

    status_data = BotStatusResponse(
        id=bot_record.id,
        bot_username=bot_record.bot_username,
        is_active=bot_record.is_active,
        is_online=is_online,
        is_rate_limited=rate_limited,
        rate_limit_until=bot_record.rate_limit_until,
        messages_today=messages_today,
        last_send_at=last_send_at,
    )

    return APIResponse(data=status_data.model_dump())
