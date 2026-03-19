import type React from "react";
import type { CalendarEvent } from "@snc/shared";

import { formatDate } from "../../lib/format.js";
import { EventCard } from "./event-card.js";
import styles from "./event-list.module.css";

// ── Public Types ──

export interface EventListProps {
  readonly events: readonly CalendarEvent[];
  readonly onEdit?: (id: string) => void;
  readonly onDelete?: (id: string) => void;
  readonly onToggleComplete?: ((id: string) => void) | undefined;
}

// ── Private Helpers ──

function groupByDate(
  events: readonly CalendarEvent[],
): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const dateKey = event.startAt.slice(0, 10);
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(event);
    } else {
      groups.set(dateKey, [event]);
    }
  }
  return groups;
}

// ── Public API ──

export function EventList({
  events,
  onEdit,
  onDelete,
  onToggleComplete,
}: EventListProps): React.ReactElement {
  if (events.length === 0) {
    return <p className={styles.empty}>No events found.</p>;
  }

  const grouped = groupByDate(events);

  return (
    <div className={styles.list}>
      {[...grouped.entries()].map(([dateKey, dayEvents]) => (
        <div key={dateKey} className={styles.dateGroup}>
          <h3 className={styles.dateHeading}>
            {formatDate(dateKey + "T00:00:00.000Z")}
          </h3>
          <div className={styles.dayEvents}>
            {dayEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleComplete={onToggleComplete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
