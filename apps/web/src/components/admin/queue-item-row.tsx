import type React from "react";
import type { PlayoutQueueEntry } from "@snc/shared";

import { formatSeconds } from "../../lib/format-duration.js";
import styles from "../../routes/admin/playout.module.css";

// ── Types ──

export interface QueueItemRowProps {
  readonly entry: PlayoutQueueEntry;
  /** Seconds until this item starts playing (cumulative duration of prior items), or null if unknown. */
  readonly estimatedStart: number | null;
  readonly onRemove: () => void;
  readonly onPlayNext?: undefined; // reserved for future
}

// ── Component ──

/** Single row in the channel queue list. */
export function QueueItemRow({
  entry,
  estimatedStart,
  onRemove,
}: QueueItemRowProps): React.ReactElement {
  const estimateLabel =
    estimatedStart === 0
      ? "Up next"
      : estimatedStart !== null
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
