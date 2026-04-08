import type React from "react";
import type { PlayoutItem } from "@snc/shared";

import { ProcessingStatusBadge } from "./processing-status-badge.js";
import styles from "../../routes/admin/playout.module.css";

// ── Types ──

export interface PlaylistItemRowProps {
  readonly item: PlayoutItem;
  readonly index: number;
  readonly total: number;
  readonly onToggleEnabled: () => void;
  readonly onDelete: () => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly onPlayNext: () => void;
}

// ── Component ──

/** Single row in the playlist management table. */
export function PlaylistItemRow({
  item,
  index,
  total,
  onToggleEnabled,
  onDelete,
  onMoveUp,
  onMoveDown,
  onPlayNext,
}: PlaylistItemRowProps): React.ReactElement {
  return (
    <li className={styles.playlistItem}>
      <div className={styles.itemReorder}>
        <button
          type="button"
          className={styles.reorderButton}
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label={`Move ${item.title} up`}
        >
          ▲
        </button>
        <button
          type="button"
          className={styles.reorderButton}
          onClick={onMoveDown}
          disabled={index === total - 1}
          aria-label={`Move ${item.title} down`}
        >
          ▼
        </button>
      </div>

      <div className={styles.itemInfo}>
        <span className={styles.itemTitle}>
          {item.title}
          {item.year !== null && (
            <span className={styles.itemYear}> ({item.year})</span>
          )}
        </span>
        {item.director !== null && (
          <span className={styles.itemDirector}>dir. {item.director}</span>
        )}
      </div>

      <ProcessingStatusBadge status={item.processingStatus} />

      <div className={styles.itemActions}>
        <label className={styles.enabledLabel}>
          <input
            type="checkbox"
            checked={item.enabled}
            onChange={onToggleEnabled}
            aria-label={`Enable ${item.title}`}
          />
          Enabled
        </label>

        <button
          type="button"
          className={styles.playNextButton}
          onClick={onPlayNext}
          disabled={item.processingStatus !== "ready"}
          aria-label={`Add ${item.title} to queue`}
        >
          Add to Queue
        </button>

        <button
          type="button"
          className={styles.deleteButton}
          onClick={onDelete}
          aria-label={`Delete ${item.title}`}
        >
          Delete
        </button>
      </div>
    </li>
  );
}
