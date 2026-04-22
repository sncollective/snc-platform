import { useState } from "react";
import type React from "react";

import { Bell } from "lucide-react";

import type { InboxNotification } from "@snc/shared";

import { useNotificationCount } from "../contexts/notification-context.js";
import { useNotifications } from "../hooks/use-notifications.js";
import { PopoverRoot, PopoverTrigger, PopoverContent } from "./ui/popover.js";

import styles from "./notification-bell.module.css";

// ── Private Helpers ──

const formatBadgeCount = (count: number): string => {
  if (count > 99) return "99+";
  return String(count);
};

// ── Public API ──

/** Notification bell icon with unread count badge and dropdown inbox. */
export function NotificationBell(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const { notifications, isLoading, initialCount, fetchNotifications, markRead, markAllRead } =
    useNotifications();

  // Prefer live WS count from app-level NotificationProvider; fall back to REST-seeded initialCount
  const wsCount = useNotificationCount();
  const displayCount = wsCount > 0 ? wsCount : initialCount;

  return (
    <div className={styles.bell}>
      <PopoverRoot
        open={open}
        onOpenChange={(details) => {
          setOpen(details.open);
          if (details.open) void fetchNotifications();
        }}
        unmountOnExit
        positioning={{ placement: "bottom-end", gutter: 8, flip: true, strategy: "fixed" }}
      >
        <PopoverTrigger asChild>
          <button
            className={styles.bellButton}
            aria-label={`Notifications${displayCount > 0 ? `, ${displayCount} unread` : ""}`}
            type="button"
          >
            <Bell size={20} aria-hidden="true" />
            {displayCount > 0 && (
              <span className={styles.badge} aria-hidden="true">
                {formatBadgeCount(displayCount)}
              </span>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent role="dialog" aria-label="Notifications" className={styles.dropdownContent}>
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownTitle}>Notifications</span>
            {notifications.some((n: InboxNotification) => !n.read) && (
              <button
                className={styles.markAllRead}
                onClick={() => void markAllRead()}
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
              {notifications.map((n: InboxNotification) => (
                <li key={n.id}>
                  <button
                    className={`${styles.notificationItem}${!n.read ? ` ${styles.unread}` : ""}`}
                    onClick={() => void markRead(n)}
                    type="button"
                  >
                    <span className={styles.notificationTitle}>{n.title}</span>
                    <span className={styles.notificationBody}>{n.body}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </PopoverRoot>
    </div>
  );
}
