import type React from "react";
import type { ReactNode } from "react";
import type { ChannelContent } from "@snc/shared";

import { formatDuration } from "../../lib/format-duration.js";
import { ResponsiveTable } from "../ui/responsive-table.js";
import type { ResponsiveTableColumn } from "../ui/responsive-table.js";
import styles from "../../routes/admin/playout.module.css";

// ── Types ──

export interface ContentPoolTableProps {
  readonly items: ChannelContent[];
  readonly onRemove: (item: ChannelContent) => void;
  readonly onRetry?: (item: ChannelContent) => void;
}

// ── Helpers ──

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

// ── Column definitions ──

const COLUMNS: readonly ResponsiveTableColumn<ChannelContent>[] = [
  {
    key: "title",
    header: "Title",
    cardRole: "title",
    cell: (item) => item.title ?? "—",
  },
  {
    key: "duration",
    header: "Duration",
    cell: (item): ReactNode =>
      item.duration !== null ? formatDuration(item.duration) : "—",
  },
  {
    key: "source",
    header: "Source",
    cell: (item): ReactNode => (
      <span className={styles.sourceBadge}>
        {item.sourceType === "playout" ? "Playout" : "Creator"}
      </span>
    ),
  },
  {
    key: "lastPlayed",
    header: "Last Played",
    cell: (item): ReactNode => relativeTime(item.lastPlayedAt),
  },
  {
    key: "plays",
    header: "Plays",
    cell: (item): ReactNode => item.playCount,
  },
];

// ── Component ──

/** Table of content pool items for a playout channel. */
export function ContentPoolTable({
  items,
  onRemove,
  onRetry,
}: ContentPoolTableProps): React.ReactElement {
  if (items.length === 0) {
    return (
      <p className={styles.emptyMessage}>
        No content in pool. Add content using the buttons above.
      </p>
    );
  }

  return (
    <ResponsiveTable<ChannelContent>
      columns={COLUMNS}
      rows={items}
      rowKey={(item) => item.id}
      label="Content pool"
      cardAriaLabel={(item) => item.title ?? "Untitled item"}
      actions={(item): ReactNode => (
        <>
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
        </>
      )}
    />
  );
}
