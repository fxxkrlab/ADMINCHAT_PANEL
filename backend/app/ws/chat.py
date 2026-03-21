"""
WebSocket endpoint at /ws/chat for real-time admin panel communication.

Authentication: JWT token passed as query parameter.
Subscribes to Redis pub/sub channels and forwards events to connected clients.
Also handles client actions: mark_read, typing.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Dict, Optional, Set

from fastapi import WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select, update

from app.database import async_session_factory
from app.models.admin import Admin
from app.models.conversation import Conversation
from app.services.redis import get_redis
from app.services.realtime import (
    CHANNEL_MESSAGES,
    CHANNEL_CONVERSATIONS,
    CHANNEL_BOT_STATUS,
    CHANNEL_AGENT_STATUS,
    publish_agent_status,
)
from app.utils.security import decode_token

logger = logging.getLogger(__name__)

# Connected WebSocket clients: admin_id -> set of WebSocket instances
_connected_clients: Dict[int, Set[WebSocket]] = {}


class ConnectionManager:
    """Manages WebSocket connections and Redis pub/sub subscriptions."""

    def __init__(self) -> None:
        self._pubsub_task: Optional[asyncio.Task] = None

    async def start_pubsub_listener(self) -> None:
        """Start the global Redis pub/sub listener (once)."""
        if self._pubsub_task and not self._pubsub_task.done():
            return
        self._pubsub_task = asyncio.create_task(self._listen_redis())
        logger.info("WebSocket Redis pub/sub listener started")

    async def stop_pubsub_listener(self) -> None:
        """Stop the global Redis pub/sub listener."""
        if self._pubsub_task and not self._pubsub_task.done():
            self._pubsub_task.cancel()
            try:
                await self._pubsub_task
            except asyncio.CancelledError:
                pass
        logger.info("WebSocket Redis pub/sub listener stopped")

    async def connect(self, websocket: WebSocket, admin_id: int) -> None:
        """Accept a WebSocket connection and register it."""
        await websocket.accept()
        if admin_id not in _connected_clients:
            _connected_clients[admin_id] = set()
        _connected_clients[admin_id].add(websocket)
        logger.info("WebSocket connected: admin_id=%s (total=%d)", admin_id, self._total_clients())

        # Broadcast agent online status
        await publish_agent_status(admin_id, True)

    async def disconnect(self, websocket: WebSocket, admin_id: int) -> None:
        """Remove a WebSocket connection."""
        clients = _connected_clients.get(admin_id)
        if clients:
            clients.discard(websocket)
            if not clients:
                del _connected_clients[admin_id]
                # Broadcast agent offline status
                await publish_agent_status(admin_id, False)
        logger.info("WebSocket disconnected: admin_id=%s (total=%d)", admin_id, self._total_clients())

    async def broadcast(self, message: str) -> None:
        """Send a message to all connected clients."""
        disconnected = []
        for admin_id, sockets in _connected_clients.items():
            for ws in list(sockets):
                try:
                    await ws.send_text(message)
                except Exception:
                    disconnected.append((admin_id, ws))

        for admin_id, ws in disconnected:
            await self.disconnect(ws, admin_id)

    def _total_clients(self) -> int:
        return sum(len(s) for s in _connected_clients.values())

    async def _listen_redis(self) -> None:
        """Subscribe to all realtime channels and broadcast to WebSocket clients."""
        redis = await get_redis()
        pubsub = redis.pubsub()
        await pubsub.subscribe(
            CHANNEL_MESSAGES,
            CHANNEL_CONVERSATIONS,
            CHANNEL_BOT_STATUS,
            CHANNEL_AGENT_STATUS,
        )
        logger.info("Subscribed to Redis channels")

        try:
            async for raw_message in pubsub.listen():
                if raw_message["type"] != "message":
                    continue
                data = raw_message.get("data")
                if isinstance(data, (str, bytes)):
                    await self.broadcast(data if isinstance(data, str) else data.decode())
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("Redis pub/sub listener error")
        finally:
            await pubsub.unsubscribe()
            await pubsub.aclose()


# Module-level singleton
ws_manager = ConnectionManager()


async def _authenticate(token: Optional[str]) -> Optional[Admin]:
    """Validate JWT token and return the Admin, or None."""
    if not token:
        return None

    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        return None

    admin_id = payload.get("sub")
    if admin_id is None:
        return None

    async with async_session_factory() as session:
        result = await session.execute(
            select(Admin).where(Admin.id == int(admin_id), Admin.is_active.is_(True))
        )
        return result.scalar_one_or_none()


async def _handle_client_action(data: dict, admin_id: int) -> None:
    """Process actions sent by the client over WebSocket."""
    action = data.get("action")

    if action == "mark_read":
        conversation_id = data.get("conversation_id")
        if conversation_id:
            async with async_session_factory() as session:
                await session.execute(
                    update(Conversation)
                    .where(Conversation.id == conversation_id)
                    .values(status="open")
                )
                await session.commit()
            logger.debug("admin=%s marked conversation %s as read", admin_id, conversation_id)

    elif action == "typing":
        conversation_id = data.get("conversation_id")
        if conversation_id:
            # Broadcast typing indicator to other clients
            payload = json.dumps({
                "event": "typing",
                "data": {
                    "admin_id": admin_id,
                    "conversation_id": conversation_id,
                },
            })
            await ws_manager.broadcast(payload)

    else:
        logger.debug("Unknown WebSocket action: %s from admin=%s", action, admin_id)


async def websocket_chat_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(default=None),
) -> None:
    """
    WebSocket endpoint handler: /ws/chat?token=<jwt>
    """
    # Authenticate
    admin = await _authenticate(token)
    if admin is None:
        await websocket.close(code=4001, reason="Authentication failed")
        return

    # Ensure the pub/sub listener is running
    await ws_manager.start_pubsub_listener()

    await ws_manager.connect(websocket, admin.id)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                await _handle_client_action(data, admin.id)
            except json.JSONDecodeError:
                logger.warning("Invalid JSON from admin %s: %s", admin.id, raw[:200])
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("WebSocket error for admin %s", admin.id)
    finally:
        await ws_manager.disconnect(websocket, admin.id)
