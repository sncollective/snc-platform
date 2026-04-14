import { useState, useRef, useEffect } from "react";
import type React from "react";
import type { ChannelContent } from "@snc/shared";

import styles from "../../routes/admin/playout.module.css";

// ── Types ──

export interface PoolItemPickerProps {
  readonly poolItems: readonly ChannelContent[];
  readonly onSelect: (item: ChannelContent) => void;
  readonly onClose: () => void;
}

// ── Helpers ──

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// ── Component ──

/** Inline picker for selecting pool items to queue. Filters to playout-source items only. */
export function PoolItemPicker({
  poolItems,
  onSelect,
  onClose,
}: PoolItemPickerProps): React.ReactElement {
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Only playout-source items can be queued (queue table only has playout_item_id)
  const queueableItems = poolItems.filter(
    (item) => item.sourceType === "playout",
  );

  const filtered = query.trim()
    ? queueableItems.filter((item) =>
        item.title?.toLowerCase().includes(query.toLowerCase()) ?? false,
      )
    : queueableItems;

  return (
    <div className={styles.searchPicker} ref={containerRef}>
      <input
        type="text"
        className={styles.searchPickerInput}
        placeholder="Filter pool items…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
        aria-label="Filter pool items"
      />
      <div className={styles.searchPickerResults}>
        {filtered.length === 0 && (
          <p className={styles.emptyMessage} style={{ padding: "var(--space-sm) var(--space-md)", margin: 0 }}>
            {queueableItems.length === 0
              ? "No playout items in pool"
              : "No matching items"}
          </p>
        )}
        {filtered.map((item) => (
          <div
            key={item.id}
            className={styles.searchPickerItem}
            role="button"
            tabIndex={0}
            onClick={() => {
              onSelect(item);
              onClose();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                onSelect(item);
                onClose();
              }
            }}
          >
            <span className={styles.sourceBadge}>Playout</span>
            <span style={{ flex: 1 }}>{item.title}</span>
            {item.duration !== null && (
              <span className={styles.queueItemEstimate}>
                {formatDuration(item.duration)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
