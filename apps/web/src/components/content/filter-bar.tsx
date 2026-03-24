import type React from "react";
import type { ContentType } from "@snc/shared";

import { clsx } from "clsx/lite";

import styles from "./filter-bar.module.css";

// ── Constants ──

interface FilterOption {
  readonly label: string;
  readonly value: ContentType | null;
}

const FILTER_OPTIONS: readonly FilterOption[] = [
  { label: "All", value: null },
  { label: "Video", value: "video" },
  { label: "Audio", value: "audio" },
  { label: "Written", value: "written" },
] as const;

// ── Public Types ──

export interface FilterBarProps {
  readonly activeFilter: ContentType | null;
  readonly onFilterChange: (filter: ContentType | null) => void;
}

// ── Public API ──

export function FilterBar({
  activeFilter,
  onFilterChange,
}: FilterBarProps): React.ReactElement {
  return (
    <div
      className={styles.filterBar}
      role="group"
      aria-label="Filter by content type"
    >
      {FILTER_OPTIONS.map((option) => (
        <button
          key={option.label}
          type="button"
          className={clsx(styles.filterButton, option.value === activeFilter && styles.filterButtonActive)}
          aria-pressed={option.value === activeFilter}
          onClick={() => onFilterChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
