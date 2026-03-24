import type React from "react";

import { clsx } from "clsx/lite";

import styles from "./view-toggle.module.css";

// ── Public Types ──

export type CalendarViewMode = "month" | "timeline";

export interface ViewToggleProps {
  readonly activeView: CalendarViewMode;
  readonly onViewChange: (view: CalendarViewMode) => void;
}

// ── Private Constants ──

const VIEW_OPTIONS: readonly { readonly value: CalendarViewMode; readonly label: string }[] = [
  { value: "month", label: "Month" },
  { value: "timeline", label: "Timeline" },
] as const;

// ── Public API ──

export function ViewToggle({
  activeView,
  onViewChange,
}: ViewToggleProps): React.ReactElement {
  return (
    <div className={styles.toggleGroup} role="group" aria-label="Calendar view">
      {VIEW_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={clsx(styles.toggleButton, option.value === activeView && styles.toggleButtonActive)}
          aria-pressed={option.value === activeView}
          onClick={() => onViewChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
