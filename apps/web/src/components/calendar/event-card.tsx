import type React from "react";
import type { CalendarEvent } from "@snc/shared";

import styles from "./event-card.module.css";

// ── Private Constants ──

const CATEGORY_LABELS: Record<CalendarEvent["category"], string> = {
  "recording-session": "Recording",
  "album-milestone": "Milestone",
  show: "Show",
  meeting: "Meeting",
};

// ── Public Types ──

export interface EventCardProps {
  readonly event: CalendarEvent;
  readonly onEdit?: ((id: string) => void) | undefined;
  readonly onDelete?: ((id: string) => void) | undefined;
}

// ── Public API ──

export function EventCard({
  event,
  onEdit,
  onDelete,
}: EventCardProps): React.ReactElement {
  const timeDisplay = event.allDay
    ? "All day"
    : new Date(event.startAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.time}>{timeDisplay}</span>
        <span className={styles.badge} data-category={event.category}>
          {CATEGORY_LABELS[event.category]}
        </span>
      </div>
      <h3 className={styles.title}>{event.title}</h3>
      {event.location && (
        <span className={styles.location}>{event.location}</span>
      )}
      {event.description && (
        <p className={styles.description}>{event.description}</p>
      )}
      {(onEdit ?? onDelete) && (
        <div className={styles.actions}>
          {onEdit && (
            <button
              type="button"
              className={styles.editButton}
              onClick={() => onEdit(event.id)}
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className={styles.deleteButton}
              onClick={() => onDelete(event.id)}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
