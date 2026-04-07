import type React from "react";
import type { ChannelContent } from "@snc/shared";

import styles from "../../routes/admin/playout.module.css";

// ── Types ──

export interface ContentPoolTableProps {
  readonly items: ChannelContent[];
  readonly onRemove: (item: ChannelContent) => void;
  readonly onRetry?: (item: ChannelContent) => void;
}

// ── Helpers ──

/** Format a duration in seconds as H:MM:SS or MM:SS. */
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Return a human-readable relative time string, e.g. "2h ago", "3d ago", or "Never". */
function relativeTime(isoString: string | null): string {
  if (isoString === null) return "Never";
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// ── Component ──

/** Table of content pool items for a playout channel. */
export function ContentPoolTable({
  items,
  onRemove,
  onRetry,
}: ContentPoolTableProps): React.ReactElement {
  if (items.length === 0) {
    return <p className={styles.emptyMessage}>No content in pool.</p>;
  }

  return (
    <table className={styles.poolTable}>
      <thead>
        <tr>
          <th className={styles.poolTableHeader}>Title</th>
          <th className={styles.poolTableHeader}>Duration</th>
          <th className={styles.poolTableHeader}>Source</th>
          <th className={styles.poolTableHeader}>Last Played</th>
          <th className={styles.poolTableHeader}>Plays</th>
          <th className={styles.poolTableHeader} />
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td className={styles.poolTableCell}>{item.title ?? "—"}</td>
            <td className={styles.poolTableCell}>
              {item.duration !== null ? formatDuration(item.duration) : "—"}
            </td>
            <td className={styles.poolTableCell}>
              <span className={styles.sourceBadge}>
                {item.sourceType === "playout" ? "Playout" : "Creator"}
              </span>
            </td>
            <td className={styles.poolTableCell}>
              {relativeTime(item.lastPlayedAt)}
            </td>
            <td className={styles.poolTableCell}>{item.playCount}</td>
            <td className={styles.poolTableCell}>
              {item.sourceType === "playout" &&
                item.processingStatus === "failed" &&
                onRetry !== undefined && (
                  <button
                    type="button"
                    className={styles.retryButton}
                    onClick={() => onRetry(item)}
                    aria-label={`Retry ingest for ${item.title ?? "item"}`}
                  >
                    Retry
                  </button>
                )}
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => onRemove(item)}
                aria-label={`Remove ${item.title ?? "item"} from pool`}
              >
                Remove
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
