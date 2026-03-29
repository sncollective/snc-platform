import { useState, useCallback } from "react";

import type { CalendarViewMode } from "../components/calendar/view-toggle.js";

// ── Public Types ──

export interface UseCalendarNavigationReturn {
  readonly viewMode: CalendarViewMode;
  readonly setViewMode: (mode: CalendarViewMode) => void;
  readonly monthOffset: number;
  readonly monthLabel: string;
  readonly currentYear: number;
  readonly currentMonthIndex: number;
  readonly handlePrev: () => void;
  readonly handleNext: () => void;
}

// ── Public API ──

/** Manage calendar view mode and month navigation state. */
export function useCalendarNavigation(): UseCalendarNavigationReturn {
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [monthOffset, setMonthOffset] = useState(0);

  const displayDate = new Date();
  displayDate.setMonth(displayDate.getMonth() + monthOffset);
  const monthLabel = displayDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const currentYear = displayDate.getFullYear();
  const currentMonthIndex = displayDate.getMonth();

  const handlePrev = useCallback(() => {
    setMonthOffset((o) => o - 1);
  }, []);

  const handleNext = useCallback(() => {
    setMonthOffset((o) => o + 1);
  }, []);

  return {
    viewMode,
    setViewMode,
    monthOffset,
    monthLabel,
    currentYear,
    currentMonthIndex,
    handlePrev,
    handleNext,
  };
}
