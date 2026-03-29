import { useState, useMemo } from "react";
import type React from "react";
import type { CalendarEvent } from "@snc/shared";

import {
  groupEventsByDate,
  buildGridCells,
  buildWeekRows,
  buildSpanBars,
  isMultiDay,
} from "./calendar-utils.js";
import type { GridCell, WeekRow, SpanBar } from "./calendar-utils.js";
import { clsx } from "clsx/lite";

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

// ── Public API ──

/** Render a month-view calendar grid with weekday headers, day cells, and multi-day event span bars. Clicking a day with overflow events opens a detail popover. */
export function CalendarGrid({
  events,
  year,
  month,
  onEventClick,
}: CalendarGridProps): React.ReactElement {
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);

  const { eventsByDate, weekRows, spanBarsByWeek } = useMemo(() => {
    const singleDayEvents = events.filter((e) => !isMultiDay(e));
    const evByDate = groupEventsByDate(singleDayEvents);
    const cells = buildGridCells(year, month);
    const rows = buildWeekRows(cells);
    const bars = buildSpanBars(events, rows);

    const byWeek = new Map<number, SpanBar[]>();
    for (const bar of bars) {
      const existing = byWeek.get(bar.weekIndex) ?? [];
      existing.push(bar);
      byWeek.set(bar.weekIndex, existing);
    }

    return { eventsByDate: evByDate, weekRows: rows, spanBars: bars, spanBarsByWeek: byWeek };
  }, [events, year, month]);

  const SPAN_BAR_HEIGHT = 20;
  const SPAN_BAR_GAP = 2;
  const DAY_NUMBER_HEIGHT = 24;

  return (
    <div className={styles.grid} role="table" aria-label="Calendar grid">
      {/* Day headers */}
      <div className={styles.headerRow} role="row">
        {WEEKDAY_HEADERS.map((day) => (
          <div key={day} className={styles.dayHeader} role="columnheader">{day}</div>
        ))}
      </div>

      {/* Week rows */}
      {weekRows.map((row) => {
        const rowBars = spanBarsByWeek.get(row.weekIndex) ?? [];
        const maxLane = rowBars.reduce((max, b) => Math.max(max, b.lane), -1);
        const spanBarSpace = maxLane >= 0 ? (maxLane + 1) * (SPAN_BAR_HEIGHT + SPAN_BAR_GAP) : 0;

        return (
          <div key={row.weekIndex} className={styles.weekRow} role="row">
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
                aria-label={bar.event.title}
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
                  role="cell"
                  className={clsx(styles.cell, !cell.isCurrentMonth && styles.cellOtherMonth)}
                >
                  <span className={styles.cellDay}>{cell.day}</span>
                  <div
                    className={styles.cellEvents}
                    style={spanBarSpace > 0 ? { marginTop: `${spanBarSpace + SPAN_BAR_GAP}px` } : undefined}
                  >
                    {visible.map((ev) => (
                      <button key={ev.id} type="button" className={styles.eventPill}
                        onClick={() => onEventClick?.(ev.id)} title={ev.title} aria-label={ev.title}>
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
