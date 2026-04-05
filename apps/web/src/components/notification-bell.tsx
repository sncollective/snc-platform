import { useState, useCallback, useEffect, useRef } from "react";
import type React from "react";

import { Bell } from "lucide-react";

import type { InboxNotification, InboxNotificationsResponse, UnreadCountResponse } from "@snc/shared";

import { useChatOptional } from "../contexts/chat-context.js";
import { apiGet, apiMutate } from "../lib/fetch-utils.js";

import styles from "./notification-bell.module.css";

// ── Private Helpers ──

const formatBadgeCount = (count: number): string => {
  if (count > 99) return "99+";
  return String(count);
};

// ── Public API ──

/** Notification bell icon with unread count badge and dropdown inbox. */
export function NotificationBell(): React.ReactElement {
  const chat = useChatOptional();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Local override for the initial REST-seeded count before WS takes over
  const [initialCount, setInitialCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // On initial render, seed unread count from REST (WS may not be connected yet)
  useEffect(() => {
    apiGet<UnreadCountResponse>("/api/notifications/unread-count")
      .then((data) => {
        if (data.count > 0) {
          // Seed the local override; WS will replace it once connected
          setInitialCount(data.count);
        }
      })
      .catch(() => {
        // Non-critical — badge will update when WS connects
      });
  }, []);

  // Once WS delivers a live count (on pages with ChatProvider), prefer it
  const wsCount = chat?.state.notificationCount ?? 0;
  const displayCount = wsCount > 0 ? wsCount : initialCount;

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

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

  const handleToggle = useCallback(() => {
    if (!isOpen) {
      void fetchNotifications();
    }
    setIsOpen((prev) => !prev);
  }, [isOpen, fetchNotifications]);

  const handleMarkRead = useCallback(
    async (notification: InboxNotification) => {
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
    },
    [],
  );

  const handleMarkAllRead = useCallback(async () => {
    try {
      await apiMutate("/api/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setInitialCount(0);
    } catch {
      // Non-critical
    }
  }, []);

  return (
    <div className={styles.bell} ref={dropdownRef}>
      <button
        className={styles.bellButton}
        onClick={handleToggle}
        aria-label={`Notifications${displayCount > 0 ? `, ${displayCount} unread` : ""}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        type="button"
      >
        <Bell size={20} aria-hidden="true" />
        {displayCount > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {formatBadgeCount(displayCount)}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="dialog" aria-label="Notifications">
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownTitle}>Notifications</span>
            {notifications.some((n) => !n.read) && (
              <button
                className={styles.markAllRead}
                onClick={() => void handleMarkAllRead()}
                type="button"
              >
                Mark all read
              </button>
            )}
          </div>

          {isLoading ? (
            <div className={styles.emptyState}>Loading…</div>
          ) : notifications.length === 0 ? (
            <div className={styles.emptyState}>No notifications</div>
          ) : (
            <ul className={styles.notificationList} role="list">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    className={`${styles.notificationItem}${!n.read ? ` ${styles.unread}` : ""}`}
                    onClick={() => void handleMarkRead(n)}
                    type="button"
                  >
                    <span className={styles.notificationTitle}>{n.title}</span>
                    <span className={styles.notificationBody}>{n.body}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
