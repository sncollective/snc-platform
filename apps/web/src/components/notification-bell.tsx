import { useState, useCallback, useEffect, useRef } from "react";
import type React from "react";

import type { InboxNotification, InboxNotificationsResponse, UnreadCountResponse } from "@snc/shared";

import { useChat } from "../contexts/chat-context.js";
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
  const { state } = useChat();
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

  // Once WS delivers a live count, clear the local override
  const wsCount = state.notificationCount;
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
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
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
