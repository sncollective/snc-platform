import { useState, useCallback, useEffect } from "react";

import type { InboxNotification, InboxNotificationsResponse, UnreadCountResponse } from "@snc/shared";

import { apiGet, apiMutate } from "../lib/fetch-utils.js";

// ── Public Types ──

export interface UseNotificationsResult {
  readonly notifications: readonly InboxNotification[];
  readonly isLoading: boolean;
  readonly initialCount: number;
  readonly fetchNotifications: () => Promise<void>;
  readonly markRead: (notification: InboxNotification) => Promise<void>;
  readonly markAllRead: () => Promise<void>;
}

// ── Public API ──

/**
 * Notification inbox data + actions.
 *
 * Seeds initialCount from REST on mount; caller combines with WS count for display.
 * Exposes fetch/mark-read/mark-all-read actions — caller owns open/close UI.
 */
export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialCount, setInitialCount] = useState(0);

  // On initial render, seed unread count from REST (WS may not be connected yet)
  useEffect(() => {
    apiGet<UnreadCountResponse>("/api/notifications/unread-count")
      .then((data) => {
        if (data.count > 0) {
          setInitialCount(data.count);
        }
      })
      .catch(() => {
        // Non-critical — badge will update when WS connects
      });
  }, []);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiGet<InboxNotificationsResponse>("/api/notifications", { limit: 10 });
      setNotifications(data.notifications);
    } catch {
      // Non-critical
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markRead = useCallback(async (notification: InboxNotification) => {
    if (!notification.read) {
      try {
        await apiMutate(`/api/notifications/${notification.id}/read`, { method: "PATCH" });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
        );
      } catch {
        // Non-critical
      }
    }
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await apiMutate("/api/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setInitialCount(0);
    } catch {
      // Non-critical
    }
  }, []);

  return {
    notifications,
    isLoading,
    initialCount,
    fetchNotifications,
    markRead,
    markAllRead,
  };
}
