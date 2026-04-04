import { useState } from "react";
import type React from "react";

import styles from "./chat-user-actions.module.css";

// ── Constants ──

const TIMEOUT_OPTIONS = [
  { label: "1 min", value: 60 },
  { label: "5 min", value: 300 },
  { label: "10 min", value: 600 },
  { label: "1 hour", value: 3600 },
];

// ── Component ──

/**
 * Context menu action buttons for moderating a specific user in chat.
 * Shown on hover/click of a user's message when the viewer is a moderator.
 */
export function ChatUserActions({
  targetUserId,
  targetUserName,
  onTimeout,
  onBan,
}: {
  readonly targetUserId: string;
  readonly targetUserName: string;
  readonly onTimeout: (userId: string, seconds: number) => void;
  readonly onBan: (userId: string) => void;
}): React.ReactElement {
  const [confirmBan, setConfirmBan] = useState(false);

  return (
    <div className={styles.actions} aria-label={`Moderation actions for ${targetUserName}`}>
      <div className={styles.timeouts}>
        {TIMEOUT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={styles.timeoutButton}
            onClick={() => onTimeout(targetUserId, opt.value)}
            title={`Timeout ${targetUserName} for ${opt.label}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {confirmBan ? (
        <div className={styles.confirmBan}>
          <span className={styles.confirmText}>Ban {targetUserName}?</span>
          <button
            type="button"
            className={styles.banConfirmButton}
            onClick={() => {
              onBan(targetUserId);
              setConfirmBan(false);
            }}
          >
            Yes, ban
          </button>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={() => setConfirmBan(false)}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={styles.banButton}
          onClick={() => setConfirmBan(true)}
          title={`Ban ${targetUserName}`}
        >
          Ban
        </button>
      )}
    </div>
  );
}
