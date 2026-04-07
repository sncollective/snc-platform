import type React from "react";
import type { PlayoutQueueEntry } from "@snc/shared";

import styles from "../../routes/admin/playout.module.css";

// ── Types ──

export interface QueueItemRowProps {
  readonly entry: PlayoutQueueEntry;
  /** Seconds until this item starts playing (cumulative duration of prior items), or null if unknown. */
  readonly estimatedStart: number | null;
  readonly onRemove: () => void;
  readonly onPlayNext?: undefined; // reserved for future
}

// ── Helpers ──

/** Format a duration in seconds as HH:MM:SS. */
function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// ── Component ──

/** Single row in the channel queue list. */
export function QueueItemRow({
  entry,
  estimatedStart,
  onRemove,
}: QueueItemRowProps): React.ReactElement {
  const estimateLabel =
    estimatedStart !== null
      ? `est. ${formatSeconds(estimatedStart)}`
      : "—";

  return (
    <li className={styles.queueItem}>
      <span className={styles.queueItemPosition}>{entry.position}</span>
      <span className={styles.queueItemTitle}>{entry.title ?? "—"}</span>
      <span className={styles.queueItemEstimate}>{estimateLabel}</span>
      <button
        type="button"
        className={styles.deleteButton}
        onClick={onRemove}
        aria-label={`Remove ${entry.title ?? "item"} from queue`}
      >
        Remove
      </button>
    </li>
  );
}
