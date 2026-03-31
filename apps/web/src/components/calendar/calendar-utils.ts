import type { CalendarEvent } from "@snc/shared";

import { toLocalDateKey } from "../../lib/format.js";

// ── Public Types ──

export interface GridCell {
  readonly dateKey: string;
  readonly day: number;
  readonly isCurrentMonth: boolean;
}

export interface WeekRow {
  readonly cells: GridCell[];
  readonly weekIndex: number;
}

export interface SpanBar {
  readonly event: CalendarEvent;
  readonly startCol: number;
  readonly spanCols: number;
  readonly weekIndex: number;
  lane: number;
}

// ── Public Helpers ──

/** Group calendar events by their local date key (YYYY-MM-DD). */
export function groupEventsByDate(
  events: readonly CalendarEvent[],
): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const dateKey = toLocalDateKey(event.startAt);
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(event);
    } else {
      groups.set(dateKey, [event]);
    }
  }
  return groups;
}

/** Format a Date to a YYYY-MM-DD string in local time. */
export function formatCellDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Build the full list of grid cells for a month view, padded to complete weeks. */
export function buildGridCells(year: number, month: number): GridCell[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const cells: GridCell[] = [];

  // Pad with previous month days
  const startDow = firstDay.getDay();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    cells.push({ dateKey: formatCellDate(d), day: d.getDate(), isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    cells.push({ dateKey: formatCellDate(date), day: d, isCurrentMonth: true });
  }

  // Pad with next month days to complete the grid
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      cells.push({ dateKey: formatCellDate(date), day: d, isCurrentMonth: false });
    }
  }

  return cells;
}

/** Split cells into rows of 7. */
export function buildWeekRows(cells: GridCell[]): WeekRow[] {
  const rows: WeekRow[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push({ cells: cells.slice(i, i + 7), weekIndex: rows.length });
  }
  return rows;
}

/** Check if event spans multiple local days. */
export function isMultiDay(event: CalendarEvent): boolean {
  if (!event.endAt) return false;
  return toLocalDateKey(event.startAt) !== toLocalDateKey(event.endAt);
}

/** Get all YYYY-MM-DD keys between two ISO dates (inclusive), in local timezone. */
export function getDateRange(startIso: string, endIso: string): string[] {
  const keys: string[] = [];
  const start = new Date(startIso);
  const end = new Date(endIso);
  const current = new Date(start);
  // Safety limit to prevent infinite loops
  const MAX_DAYS = 366;
  let count = 0;
  while (current <= end && count < MAX_DAYS) {
    keys.push(toLocalDateKey(current.toISOString()));
    current.setDate(current.getDate() + 1);
    count++;
  }
  return keys;
}

/**
 * Build span bars for multi-day events across week rows.
 * A single multi-day event may produce multiple SpanBars if it crosses a week boundary.
 */
export function buildSpanBars(
  events: readonly CalendarEvent[],
  weekRows: WeekRow[],
): SpanBar[] {
  const dateToPosition = new Map<string, { weekIndex: number; col: number }>();
  for (const row of weekRows) {
    for (let col = 0; col < row.cells.length; col++) {
      dateToPosition.set(row.cells[col]!.dateKey, { weekIndex: row.weekIndex, col });
    }
  }

  const multiDayEvents = events.filter(isMultiDay);
  const bars: SpanBar[] = [];

  for (const event of multiDayEvents) {
    const dateKeys = getDateRange(event.startAt, event.endAt!);
    let currentWeek = -1;
    let startCol = 0;
    let spanCols = 0;

    for (const key of dateKeys) {
      const pos = dateToPosition.get(key);
      if (!pos) continue;

      if (pos.weekIndex !== currentWeek) {
        if (spanCols > 0) {
          bars.push({ event, startCol, spanCols, weekIndex: currentWeek, lane: 0 });
        }
        currentWeek = pos.weekIndex;
        startCol = pos.col;
        spanCols = 1;
      } else {
        spanCols++;
      }
    }
    if (spanCols > 0) {
      bars.push({ event, startCol, spanCols, weekIndex: currentWeek, lane: 0 });
    }
  }

  // Assign lanes (vertical stacking) per week row
  const barsByWeek = new Map<number, SpanBar[]>();
  for (const bar of bars) {
    const existing = barsByWeek.get(bar.weekIndex) ?? [];
    existing.push(bar);
    barsByWeek.set(bar.weekIndex, existing);
  }

  for (const weekBars of barsByWeek.values()) {
    weekBars.sort((a, b) => a.startCol - b.startCol);
    const lanes: number[] = [];
    for (const bar of weekBars) {
      let assigned = false;
      for (let lane = 0; lane < lanes.length; lane++) {
        if (lanes[lane]! <= bar.startCol) {
          bar.lane = lane;
          lanes[lane] = bar.startCol + bar.spanCols;
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        bar.lane = lanes.length;
        lanes.push(bar.startCol + bar.spanCols);
      }
    }
  }

  return bars;
}
