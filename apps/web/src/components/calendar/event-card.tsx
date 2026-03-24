import type React from "react";
import { DEFAULT_EVENT_TYPE_LABELS } from "@snc/shared";
import type { CalendarEvent } from "@snc/shared";

import { clsx } from "clsx/lite";

import styles from "./event-card.module.css";

// ── Private Helpers ──

/** Resolve a display label for any event type slug. */
const resolveEventTypeLabel = (slug: string): string =>
  (DEFAULT_EVENT_TYPE_LABELS as Readonly<Record<string, string>>)[slug] ??
  slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ── Public Types ──

export interface EventCardProps {
  readonly event: CalendarEvent;
  readonly onEdit?: ((id: string) => void) | undefined;
  readonly onDelete?: ((id: string) => void) | undefined;
  readonly onToggleComplete?: ((id: string) => void) | undefined;
}

// ── Public API ──

export function EventCard({
  event,
  onEdit,
  onDelete,
  onToggleComplete,
}: EventCardProps): React.ReactElement {
  const isTask = event.eventType === "task";
  const isCompleted = event.completedAt !== null;

  const timeDisplay = event.allDay
    ? "All day"
    : new Date(event.startAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

  return (
    <div className={clsx(styles.card, isCompleted && styles.taskCompleted)}>
      <div className={styles.header}>
        <span className={styles.time}>{timeDisplay}</span>
        <div className={styles.badges}>
          <span className={styles.badge} data-event-type={event.eventType}>
            {resolveEventTypeLabel(event.eventType)}
          </span>
          {event.projectName && (
            <span className={styles.projectBadge}>{event.projectName}</span>
          )}
          {event.creatorName && (
            <span className={styles.creatorBadge}>{event.creatorName}</span>
          )}
        </div>
      </div>
      <div className={styles.titleRow}>
        {isTask && (
          <input
            type="checkbox"
            className={styles.taskCheckbox}
            checked={isCompleted}
            onChange={() => onToggleComplete?.(event.id)}
            aria-label={isCompleted ? `Mark "${event.title}" incomplete` : `Complete "${event.title}"`}
          />
        )}
        <h3 className={styles.title}>{event.title}</h3>
      </div>
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
