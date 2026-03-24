import { useRef } from "react";
import type React from "react";
import type { CalendarEvent } from "@snc/shared";

import { useDismiss } from "../../hooks/use-dismiss.js";
import { formatLocalDate } from "../../lib/format.js";
import { EventCard } from "./event-card.js";
import styles from "./day-detail-popover.module.css";

// ── Public Types ──

export interface DayDetailPopoverProps {
  /** YYYY-MM-DD date key for the day */
  readonly dateKey: string;
  /** All events for this day (single-day + multi-day) */
  readonly events: readonly CalendarEvent[];
  /** Called when popover should close */
  readonly onClose: () => void;
  /** Called when user clicks an event */
  readonly onEventClick?: (id: string) => void;
}

// ── Public API ──

export function DayDetailPopover({
  dateKey,
  events,
  onClose,
  onEventClick,
}: DayDetailPopoverProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  useDismiss(containerRef, onClose);

  return (
    <div ref={containerRef} className={styles.popover} role="dialog" aria-label={`Events for ${formatLocalDate(dateKey)}`}>
      <div className={styles.header}>
        <h3 className={styles.heading}>{formatLocalDate(dateKey)}</h3>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className={styles.eventList}>
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onEdit={onEventClick}
          />
        ))}
      </div>
    </div>
  );
}
