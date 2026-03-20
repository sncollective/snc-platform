import { useState } from "react";
import type React from "react";
import type { CalendarEvent } from "@snc/shared";

import { toLocalDateKey } from "../../lib/format.js";
import styles from "./calendar-grid.module.css";

// ── Private Constants ──

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MAX_VISIBLE_EVENTS = 3;

// ── Public Types ──

export interface CalendarGridProps {
  readonly events: readonly CalendarEvent[];
  readonly year: number;
  readonly month: number;
  readonly onEventClick?: (id: string) => void;
}

// ── Private Types ──

interface GridCell {
  dateKey: string;
  day: number;
  isCurrentMonth: boolean;
}

interface WeekRow {
  cells: GridCell[];
  weekIndex: number;
}

interface SpanBar {
  event: CalendarEvent;
  startCol: number;
  spanCols: number;
  weekIndex: number;
  lane: number;
}

// ── Private Helpers ──

function groupEventsByLocalDate(
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

function formatCellDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildGridCells(year: number, month: number): GridCell[] {
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
function buildWeekRows(cells: GridCell[]): WeekRow[] {
  const rows: WeekRow[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push({ cells: cells.slice(i, i + 7), weekIndex: rows.length });
  }
  return rows;
}

/** Check if event spans multiple local days. */
function isMultiDay(event: CalendarEvent): boolean {
  if (!event.endAt) return false;
  return toLocalDateKey(event.startAt) !== toLocalDateKey(event.endAt);
}

/** Get all YYYY-MM-DD keys between two ISO dates (inclusive), in local timezone. */
function getDateRange(startIso: string, endIso: string): string[] {
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
function buildSpanBars(
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

// ── Public API ──

export function CalendarGrid({
  events,
  year,
  month,
  onEventClick,
}: CalendarGridProps): React.ReactElement {
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);

  const singleDayEvents = events.filter((e) => !isMultiDay(e));
  const eventsByDate = groupEventsByLocalDate(singleDayEvents);
  const cells = buildGridCells(year, month);
  const weekRows = buildWeekRows(cells);
  const spanBars = buildSpanBars(events, weekRows);

  const SPAN_BAR_HEIGHT = 20;
  const SPAN_BAR_GAP = 2;
  const DAY_NUMBER_HEIGHT = 24;

  return (
    <div className={styles.grid}>
      {/* Day headers */}
      <div className={styles.headerRow}>
        {WEEKDAY_HEADERS.map((day) => (
          <div key={day} className={styles.dayHeader}>{day}</div>
        ))}
      </div>

      {/* Week rows */}
      {weekRows.map((row) => {
        const rowBars = spanBars.filter((b) => b.weekIndex === row.weekIndex);
        const maxLane = rowBars.reduce((max, b) => Math.max(max, b.lane), -1);
        const spanBarSpace = maxLane >= 0 ? (maxLane + 1) * (SPAN_BAR_HEIGHT + SPAN_BAR_GAP) : 0;

        return (
          <div key={row.weekIndex} className={styles.weekRow}>
            {/* Span bars */}
            {rowBars.map((bar) => (
              <button
                key={`${bar.event.id}-w${bar.weekIndex}`}
                type="button"
                className={styles.spanBar}
                style={{
                  top: `${DAY_NUMBER_HEIGHT + bar.lane * (SPAN_BAR_HEIGHT + SPAN_BAR_GAP)}px`,
                  left: `${(bar.startCol / 7) * 100}%`,
                  width: `${(bar.spanCols / 7) * 100}%`,
                  height: `${SPAN_BAR_HEIGHT}px`,
                }}
                onClick={() => onEventClick?.(bar.event.id)}
                title={bar.event.title}
              >
                {bar.event.title}
              </button>
            ))}

            {/* Day cells */}
            {row.cells.map((cell) => {
              const dayEvents = eventsByDate.get(cell.dateKey) ?? [];
              const isExpanded = expandedDayKey === cell.dateKey;
              const adjustedMax = Math.max(0, MAX_VISIBLE_EVENTS - (maxLane + 1));
              const visible = isExpanded ? dayEvents : dayEvents.slice(0, adjustedMax);
              const overflow = isExpanded ? 0 : dayEvents.length - visible.length;

              return (
                <div
                  key={cell.dateKey}
                  className={cell.isCurrentMonth ? styles.cell : `${styles.cell} ${styles.cellOtherMonth}`}
                >
                  <span className={styles.cellDay}>{cell.day}</span>
                  <div
                    className={styles.cellEvents}
                    style={spanBarSpace > 0 ? { marginTop: `${spanBarSpace + SPAN_BAR_GAP}px` } : undefined}
                  >
                    {visible.map((ev) => (
                      <button key={ev.id} type="button" className={styles.eventPill}
                        onClick={() => onEventClick?.(ev.id)} title={ev.title}>
                        {ev.title}
                      </button>
                    ))}
                    {overflow > 0 && (
                      <button
                        type="button"
                        className={styles.overflow}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedDayKey(cell.dateKey);
                        }}
                      >
                        +{overflow} more
                      </button>
                    )}
                    {isExpanded && dayEvents.length > adjustedMax && (
                      <button
                        type="button"
                        className={styles.overflow}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedDayKey(null);
                        }}
                      >
                        Show less
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
