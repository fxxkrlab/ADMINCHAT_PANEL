import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import type { WSEvent } from '../types';

interface UseWebSocketOptions {
  onMessage?: (event: WSEvent) => void;
  /** Base reconnect interval in ms (default 1000). Uses exponential backoff. */
  baseReconnectInterval?: number;
  /** Maximum reconnect interval in ms (default 30000). */
  maxReconnectInterval?: number;
  maxRetries?: number;
  /** Batch window: collect messages arriving within this window (ms) and flush together. */
  batchWindow?: number;
  /** Heartbeat ping interval in ms (default 30000). */
  heartbeatInterval?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    baseReconnectInterval = 1000,
    maxReconnectInterval = 30000,
    maxRetries = 10,
    batchWindow = 100,
    heartbeatInterval = 30000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const batchRef = useRef<WSEvent[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onMessageRef = useRef(onMessage);
  const connectRef = useRef<() => void>(() => {});
  const [isConnected, setIsConnected] = useState(false);
  const token = useAuthStore((s) => s.token);

  // Keep callback ref fresh to avoid re-creating the WebSocket on every render
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  // Flush batched messages as a single processing pass
  const flushBatch = useCallback(() => {
    const batch = batchRef.current;
    batchRef.current = [];
    batchTimerRef.current = undefined;
    const handler = onMessageRef.current;
    if (!handler || batch.length === 0) return;
    for (const evt of batch) {
      handler(evt);
    }
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = undefined;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, heartbeatInterval);
  }, [heartbeatInterval, stopHeartbeat]);

  // Setup connect function and store in ref for recursive reconnect
  useEffect(() => {
    const doConnect = () => {
      if (!token) return;

      // Cleanup previous connection attempt
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.onopen = null;
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected to', wsUrl.replace(/token=.*/, 'token=***'));
        setIsConnected(true);
        retriesRef.current = 0;
        startHeartbeat();
      };

      ws.onmessage = (event) => {
        try {
          const data: WSEvent = JSON.parse(event.data);
          // Skip pong responses
          if ((data as unknown as { type: string }).type === 'pong') return;

          // Batch messages: collect within batchWindow, then flush together
          batchRef.current.push(data);
          if (!batchTimerRef.current) {
            batchTimerRef.current = setTimeout(flushBatch, batchWindow);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = (event) => {
        console.log('[WS] Disconnected, code:', event.code, 'reason:', event.reason);
        setIsConnected(false);
        wsRef.current = null;
        stopHeartbeat();

        if (retriesRef.current < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s, 8s, ... capped at maxReconnectInterval
          const delay = Math.min(
            baseReconnectInterval * Math.pow(2, retriesRef.current),
            maxReconnectInterval,
          );
          retriesRef.current += 1;
          reconnectTimerRef.current = setTimeout(() => connectRef.current(), delay);
        }
      };

      ws.onerror = (err) => {
        console.error('[WS] Error:', err);
        ws.close();
      };
    };

    connectRef.current = doConnect;
  }, [token, baseReconnectInterval, maxReconnectInterval, maxRetries, batchWindow, flushBatch, startHeartbeat, stopHeartbeat]);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimerRef.current);
    clearTimeout(batchTimerRef.current);
    stopHeartbeat();
    retriesRef.current = maxRetries; // prevent reconnect
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent reconnect handler
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [maxRetries, stopHeartbeat]);

  const sendMessage = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connectRef.current();
    return () => {
      clearTimeout(reconnectTimerRef.current);
      clearTimeout(batchTimerRef.current);
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = undefined;
      }
      retriesRef.current = maxRetries;
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
    };
  // Only re-connect when token changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return { isConnected, sendMessage, disconnect };
}
