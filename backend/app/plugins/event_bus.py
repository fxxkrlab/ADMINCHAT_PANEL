from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import Any, Callable, Coroutine

logger = logging.getLogger("acp.plugins.event_bus")

HANDLER_TIMEOUT_SECONDS = 10

HandlerType = Callable[..., Coroutine[Any, Any, Any]]


class PluginEventBus:
    """Pub/sub event bus for inter-plugin and system-to-plugin communication.

    Handlers are scoped to plugin IDs so they can be bulk-unsubscribed
    when a plugin is deactivated.
    """

    def __init__(self) -> None:
        self._subscribers: dict[str, list[tuple[str, HandlerType]]] = defaultdict(list)

    def subscribe(
        self, plugin_id: str, event: str, handler: HandlerType
    ) -> None:
        """Register a handler for an event, scoped to a plugin."""
        self._subscribers[event].append((plugin_id, handler))
        logger.debug(
            "Plugin %s subscribed to event %s", plugin_id, event
        )

    def unsubscribe_all(self, plugin_id: str) -> None:
        """Remove all event subscriptions for a plugin."""
        removed = 0
        for event in list(self._subscribers.keys()):
            before = len(self._subscribers[event])
            self._subscribers[event] = [
                (pid, handler)
                for pid, handler in self._subscribers[event]
                if pid != plugin_id
            ]
            removed += before - len(self._subscribers[event])
            if not self._subscribers[event]:
                del self._subscribers[event]

        if removed:
            logger.info(
                "Unsubscribed %d handler(s) for plugin %s", removed, plugin_id
            )

    async def emit(self, event: str, data: Any = None) -> None:
        """Emit an event to all subscribed handlers.

        Each handler is called with a timeout. Errors in individual handlers
        are caught and logged without affecting other handlers.
        """
        handlers = self._subscribers.get(event, [])
        if not handlers:
            return

        logger.debug("Emitting event %s to %d handler(s)", event, len(handlers))

        for plugin_id, handler in handlers:
            task = asyncio.create_task(handler(data))
            try:
                await asyncio.wait_for(
                    asyncio.shield(task),
                    timeout=HANDLER_TIMEOUT_SECONDS,
                )
            except asyncio.TimeoutError:
                task.cancel()
                logger.error(
                    "Handler for event %s from plugin %s timed out after %ds",
                    event,
                    plugin_id,
                    HANDLER_TIMEOUT_SECONDS,
                )
                # Suppress the CancelledError from the cancelled task
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass
            except Exception:
                logger.exception(
                    "Handler for event %s from plugin %s raised an error",
                    event,
                    plugin_id,
                )
