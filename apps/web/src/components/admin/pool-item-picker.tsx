import { useRef, useState } from "react";
import type React from "react";
import type { ChannelContent } from "@snc/shared";

import { useDismissOnOutsideClickAndEscape } from "../../hooks/use-dismiss-on-outside-click-and-escape.js";
import { useListboxNavigation } from "../../hooks/use-listbox-navigation.js";
import { formatDuration } from "../../lib/format-duration.js";
import styles from "../../routes/admin/playout.module.css";

// ── Types ──

export interface PoolItemPickerProps {
  readonly poolItems: readonly ChannelContent[];
  readonly onSelect: (item: ChannelContent) => void;
  readonly onClose: () => void;
}

// ── Component ──

/**
 * Inline picker for selecting pool items to queue. Both source types are
 * queueable — playout-library items and creator content — since the queue is
 * source-polymorphic. The chosen item is handed back via `onSelect`; the surface
 * routes it to the queue under the correct discriminated source.
 */
export function PoolItemPicker({
  poolItems,
  onSelect,
  onClose,
}: PoolItemPickerProps): React.ReactElement {
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useDismissOnOutsideClickAndEscape(containerRef, onClose);

  // Every pool item is queueable: the queue carries either a playout item or a
  // content piece, so playout and creator-content rows are both selectable.
  const filtered = query.trim()
    ? poolItems.filter((item) =>
        item.title?.toLowerCase().includes(query.toLowerCase()) ?? false,
      )
    : poolItems;

  const handleSelect = (item: ChannelContent): void => {
    onSelect(item);
    onClose();
  };

  const listbox = useListboxNavigation({
    items: filtered,
    getItemId: (item) => `pool-item-opt-${item.id}`,
    onSelect: handleSelect,
    listboxId: "pool-item-listbox",
    listboxLabel: "Content pool results",
  });

  return (
    <div className={styles.searchPicker} ref={containerRef}>
      <input
        type="text"
        className={styles.searchPickerInput}
        placeholder="Filter pool items…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        aria-label="Filter pool items"
        {...listbox.getInputProps()}
      />
      <ul className={styles.searchPickerResults} {...listbox.getListboxProps()}>
        {filtered.length === 0 && (
          <li role="presentation" className={styles.emptyMessage} style={{ padding: "var(--space-sm) var(--space-md)", margin: 0 }}>
            {poolItems.length === 0
              ? <>No items in pool. Add content or playout items to the pool, then queue them here.</>
              : "No matching items"}
          </li>
        )}
        {filtered.map((item, index) => (
          <li
            key={item.id}
            className={styles.searchPickerItem}
            {...listbox.getOptionProps(item, index)}
          >
            <span className={styles.sourceBadge}>
              {item.sourceType === "content" ? "Content" : "Playout"}
            </span>
            <span style={{ flex: 1 }}>{item.title}</span>
            {item.duration !== null && (
              <span className={styles.queueItemEstimate}>
                {formatDuration(item.duration)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
