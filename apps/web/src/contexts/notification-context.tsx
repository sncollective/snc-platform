"use no memo";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type React from "react";
import type { ReactNode } from "react";

// ── Public Types ──

export interface NotificationContextValue {
  readonly wsCount: number;
}

// ── Context ──

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ── Provider ──

export interface NotificationProviderProps {
  readonly children: ReactNode;
  /** Current user id. WebSocket connects only when authenticated. */
  readonly userId: string | null;
}

/**
 * App-level provider for the live unread notification count.
 *
 * Opens a WebSocket to `/api/chat/ws` to receive `notification_count` events
 * independent of the chat feature, so the notification bell updates on every
 * page (not just `/live`). Does nothing when `userId` is null.
 */
export function NotificationProvider({
  children,
  userId,
}: NotificationProviderProps): React.ReactElement {
  const [wsCount, setWsCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    if (!userId) {
      setWsCount(0);
      return;
    }

    let closed = false;

    const connect = (): void => {
      if (closed) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/chat/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as {
            type: string;
            count?: number;
          };
          if (data.type === "notification_count" && typeof data.count === "number") {
            setWsCount(data.count);
          }
        } catch {
          // Malformed message — ignore
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (closed) return;
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30_000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closed = true;
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [userId]);

  return (
    <NotificationContext.Provider value={{ wsCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

// ── Consumer Hook ──

/** Access the live unread notification count. Returns 0 outside NotificationProvider. */
export function useNotificationCount(): number {
  return useContext(NotificationContext)?.wsCount ?? 0;
}
