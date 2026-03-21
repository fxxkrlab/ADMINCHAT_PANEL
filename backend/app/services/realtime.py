"""
Redis pub/sub service for real-time event broadcasting.

All events published here are consumed by the WebSocket layer
and forwarded to connected admin clients.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.services.redis import get_redis

logger = logging.getLogger(__name__)

# ---- Redis channel names ----
CHANNEL_MESSAGES = "adminchat:messages"
CHANNEL_CONVERSATIONS = "adminchat:conversations"
CHANNEL_BOT_STATUS = "adminchat:bot_status"
CHANNEL_AGENT_STATUS = "adminchat:agent_status"


def _serialize(data: Any) -> str:
    """JSON-serialize with datetime support."""

    def _default(obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

    return json.dumps(data, default=_default, ensure_ascii=False)


async def publish_new_message(
    conversation_id: int,
    message_data: Dict[str, Any],
) -> None:
    """Publish a new_message event."""
    redis = await get_redis()
    payload = {
        "event": "new_message",
        "data": {
            "conversation_id": conversation_id,
            "message": message_data,
        },
    }
    await redis.publish(CHANNEL_MESSAGES, _serialize(payload))
    logger.debug("Published new_message for conversation %s", conversation_id)


async def publish_conversation_update(
    conversation_id: int,
    status: str,
    unread_count: int = 0,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    """Publish a conversation_updated event."""
    redis = await get_redis()
    data: Dict[str, Any] = {
        "conversation_id": conversation_id,
        "status": status,
        "unread_count": unread_count,
    }
    if extra:
        data.update(extra)
    payload = {
        "event": "conversation_updated",
        "data": data,
    }
    await redis.publish(CHANNEL_CONVERSATIONS, _serialize(payload))
    logger.debug("Published conversation_updated for %s", conversation_id)


async def publish_bot_status(
    bot_id: int,
    status_data: Dict[str, Any],
) -> None:
    """Publish a bot_status event."""
    redis = await get_redis()
    payload = {
        "event": "bot_status",
        "data": {"bot_id": bot_id, **status_data},
    }
    await redis.publish(CHANNEL_BOT_STATUS, _serialize(payload))
    logger.debug("Published bot_status for bot %s", bot_id)


async def publish_agent_status(
    admin_id: int,
    is_online: bool,
) -> None:
    """Publish an agent_status event."""
    redis = await get_redis()
    payload = {
        "event": "agent_status",
        "data": {"admin_id": admin_id, "is_online": is_online},
    }
    await redis.publish(CHANNEL_AGENT_STATUS, _serialize(payload))
