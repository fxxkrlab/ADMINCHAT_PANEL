import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.admin import Admin
from app.models.conversation import Conversation
from app.models.message import Message
from app.bot.dispatcher import get_bot_instance
from app.services.media import media_cache
from app.utils.security import decode_token

logger = logging.getLogger(__name__)

router = APIRouter()


async def _authenticate_media_request(
    db: AsyncSession,
    token: Optional[str] = None,
) -> Admin:
    """Authenticate via query param token (for img tags) or raise 401."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    admin_id = payload.get("sub")
    if admin_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    result = await db.execute(select(Admin).where(Admin.id == int(admin_id)))
    admin = result.scalar_one_or_none()
    if admin is None or not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return admin


@router.get("/{message_id}/media")
async def get_message_media(
    message_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    token: Optional[str] = Query(None),
) -> Response:
    """Fetch media file from cache or TG API.

    Authentication is done via ?token= query parameter so that
    <img src="..."> tags can access media without AJAX headers.
    """
    await _authenticate_media_request(db, token)
    result = await db.execute(select(Message).where(Message.id == message_id))
    msg = result.scalar_one_or_none()

    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    if not msg.media_file_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No media attached to this message")

    def _content_type_for(content_type: str) -> str:
        if content_type == "photo":
            return "image/jpeg"
        if content_type == "video":
            return "video/mp4"
        if content_type == "voice":
            return "audio/ogg"
        if content_type == "animation":
            return "image/gif"
        if content_type == "audio":
            return "audio/mpeg"
        return "application/octet-stream"

    # Check local cache first (via MediaCacheService)
    cached_path = media_cache.get_cached_media(msg.media_file_id)
    if cached_path:
        with open(cached_path, "rb") as f:
            content = f.read()
        return Response(
            content=content,
            media_type=_content_type_for(msg.content_type),
            headers={"Cache-Control": "public, max-age=86400"},
        )

    # Also check DB-level cache flag
    if msg.media_cached and msg.media_cache_path:
        import os
        if os.path.exists(msg.media_cache_path):
            with open(msg.media_cache_path, "rb") as f:
                content = f.read()
            return Response(
                content=content,
                media_type=_content_type_for(msg.content_type),
                headers={"Cache-Control": "public, max-age=86400"},
            )

    # Download from Telegram Bot API
    conv_result = await db.execute(
        select(Conversation).where(Conversation.id == msg.conversation_id)
    )
    conv = conv_result.scalar_one_or_none()
    if not conv or not conv.primary_bot_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No bot available to download media",
        )

    bot_instance = get_bot_instance(conv.primary_bot_id)
    if not bot_instance:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Bot instance not running",
        )

    # Use MediaCacheService to download and cache
    cache_path = await media_cache.cache_media(msg.media_file_id, bot_instance)
    if not cache_path:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to download media from Telegram",
        )

    # Update DB cache metadata
    from datetime import datetime, timedelta
    msg.media_cached = True
    msg.media_cache_path = cache_path
    msg.media_cache_expires = datetime.utcnow() + timedelta(days=media_cache.ttl_days)
    await db.flush()

    with open(cache_path, "rb") as f:
        content = f.read()

    return Response(
        content=content,
        media_type=_content_type_for(msg.content_type),
        headers={"Cache-Control": "public, max-age=86400"},
    )
