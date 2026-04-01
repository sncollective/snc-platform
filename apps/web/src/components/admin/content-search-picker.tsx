import { useEffect, useRef, useState } from "react";
import type React from "react";
import type { PoolCandidate } from "@snc/shared";

import { searchAvailableContent } from "../../lib/playout-channels.js";
import styles from "../../routes/admin/playout.module.css";

// ── Types ──

export interface ContentSearchPickerProps {
  readonly channelId: string;
  readonly onSelect: (item: PoolCandidate) => void;
  readonly onClose: () => void;
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

// ── Component ──

/** Dropdown search picker for adding content to a channel's pool or queue. */
export function ContentSearchPicker({
  channelId,
  onSelect,
  onClose,
}: ContentSearchPickerProps): React.ReactElement {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PoolCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search with abort on new input
  useEffect(() => {
    const debounceId = setTimeout(() => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      if (!query.trim()) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      searchAvailableContent(channelId, query.trim(), controller.signal)
        .then((data) => {
          setResults(data.items);
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === "AbortError") return;
          setResults([]);
          setIsLoading(false);
        });
    }, 300);

    return () => {
      clearTimeout(debounceId);
    };
  }, [channelId, query]);

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

  const handleSelect = (item: PoolCandidate): void => {
    onSelect(item);
    onClose();
  };

  const showEmpty = !isLoading && query.trim() && results.length === 0;
  const showPrompt = !query.trim();

  return (
    <div className={styles.searchPicker} ref={containerRef}>
      <input
        type="text"
        className={styles.searchPickerInput}
        placeholder="Search content…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        aria-label="Search content"
      />
      <div className={styles.searchPickerResults}>
        {showPrompt && (
          <p className={styles.emptyMessage} style={{ padding: "var(--space-sm) var(--space-md)", margin: 0 }}>
            Start typing to search
          </p>
        )}
        {isLoading && (
          <p className={styles.emptyMessage} style={{ padding: "var(--space-sm) var(--space-md)", margin: 0 }}>
            Searching…
          </p>
        )}
        {showEmpty && (
          <p className={styles.emptyMessage} style={{ padding: "var(--space-sm) var(--space-md)", margin: 0 }}>
            No matching content
          </p>
        )}
        {results.map((item) => (
          <div
            key={`${item.sourceType}-${item.id}`}
            className={styles.searchPickerItem}
            role="button"
            tabIndex={0}
            onClick={() => handleSelect(item)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleSelect(item);
            }}
          >
            <span className={styles.sourceBadge}>
              {item.sourceType === "playout"
                ? "Playout"
                : `Creator${item.creator ? `: ${item.creator}` : ""}`}
            </span>
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
