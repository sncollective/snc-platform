import type React from "react";
import type { CalendarEvent } from "@snc/shared";

import { formatLocalDate } from "../../lib/format.js";
import { groupEventsByDate } from "./calendar-utils.js";
import { EventCard } from "./event-card.js";
import styles from "./event-list.module.css";

// ── Public Types ──

export interface EventListProps {
  readonly events: readonly CalendarEvent[];
  readonly onEdit?: ((id: string) => void) | undefined;
  readonly onDelete?: ((id: string) => void) | undefined;
  readonly onToggleComplete?: ((id: string) => void) | undefined;
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

  const grouped = groupEventsByDate(events);

  return (
    <div className={styles.list}>
      {[...grouped.entries()].map(([dateKey, dayEvents]) => (
        <div key={dateKey} className={styles.dateGroup}>
          <h3 className={styles.dateHeading}>
            {formatLocalDate(dateKey)}
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
