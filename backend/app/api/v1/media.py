from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.admin import Admin
from app.models.message import Message

router = APIRouter()


@router.get("/{message_id}/media")
async def get_message_media(
    message_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Admin, Depends(get_current_user)],
) -> Response:
    """Fetch media file from cache or TG API.

    In production this would:
    1. Check if media is cached locally
    2. If cached and not expired, serve from disk
    3. If not cached, download via Bot API using media_file_id
    4. Cache the file and serve
    """
    result = await db.execute(select(Message).where(Message.id == message_id))
    msg = result.scalar_one_or_none()

    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    if not msg.media_file_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No media attached to this message")

    # Check local cache
    if msg.media_cached and msg.media_cache_path:
        import os
        if os.path.exists(msg.media_cache_path):
            with open(msg.media_cache_path, "rb") as f:
                content = f.read()

            content_type = "application/octet-stream"
            if msg.content_type == "photo":
                content_type = "image/jpeg"
            elif msg.content_type == "video":
                content_type = "video/mp4"
            elif msg.content_type == "voice":
                content_type = "audio/ogg"
            elif msg.content_type == "animation":
                content_type = "image/gif"

            return Response(
                content=content,
                media_type=content_type,
                headers={"Cache-Control": "public, max-age=86400"},
            )

    # TODO: In production, download from Telegram Bot API:
    # 1. Use bot token to call getFile(file_id=msg.media_file_id)
    # 2. Download the file from the returned file_path
    # 3. Cache locally on disk
    # 4. Update msg.media_cached, msg.media_cache_path, msg.media_cache_expires
    # 5. Serve the file

    # Placeholder response
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Media download from Telegram not yet implemented. File ID: " + (msg.media_file_id or ""),
    )
