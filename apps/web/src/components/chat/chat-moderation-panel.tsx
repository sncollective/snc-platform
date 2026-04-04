import type React from "react";

import styles from "./chat-moderation-panel.module.css";

// ── Constants ──

const SLOW_MODE_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "3s", value: 3 },
  { label: "5s", value: 5 },
  { label: "10s", value: 10 },
  { label: "30s", value: 30 },
  { label: "1m", value: 60 },
  { label: "2m", value: 120 },
  { label: "5m", value: 300 },
];

// ── Component ──

/**
 * Moderation controls for chat moderators. Visible only when isModerator is true.
 * Rendered inside ChatPanel above the message input.
 */
export function ChatModerationPanel({
  slowModeSeconds,
  onSetSlowMode,
}: {
  readonly slowModeSeconds: number;
  readonly onSetSlowMode: (seconds: number) => void;
}): React.ReactElement {
  return (
    <div className={styles.panel}>
      <span className={styles.label}>Slow mode:</span>
      <div className={styles.options}>
        {SLOW_MODE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={
              opt.value === slowModeSeconds ? styles.optionActive : styles.option
            }
            onClick={() => onSetSlowMode(opt.value)}
            aria-pressed={opt.value === slowModeSeconds}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
