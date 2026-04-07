import type React from "react";
import { Bell, MapPin } from "lucide-react";
import type { UpcomingEvent } from "@snc/shared";
import { DEFAULT_EVENT_TYPE_LABELS } from "@snc/shared";
import type { DEFAULT_EVENT_TYPES } from "@snc/shared";

import styles from "./event-card.module.css";

export interface EventCardProps {
  readonly event: UpcomingEvent;
}

/** Render an upcoming event card with date badge, title, and details. */
export function EventCard({ event }: EventCardProps): React.ReactElement {
  const startDate = new Date(event.startAt);
  const month = startDate.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const day = startDate.getDate();

  const typeLabel =
    DEFAULT_EVENT_TYPE_LABELS[event.eventType as (typeof DEFAULT_EVENT_TYPES)[number]] ??
    event.eventType;

  return (
    <article className={styles.card}>
      <div className={styles.dateBadge}>
        <span className={styles.month}>{month}</span>
        <span className={styles.day}>{day}</span>
      </div>
      <div className={styles.info}>
        <div className={styles.meta}>
          <span className={styles.typeTag}>{typeLabel}</span>
          {event.creatorName && (
            <span className={styles.creator}>{event.creatorName}</span>
          )}
        </div>
        <h3 className={styles.title}>{event.title}</h3>
        {event.location && (
          <span className={styles.location}>
            <MapPin size={14} aria-hidden="true" />
            {event.location}
          </span>
        )}
      </div>
      <button
        type="button"
        className={styles.remindButton}
        disabled
        title="Coming soon"
        aria-label={`Remind me about ${event.title}`}
      >
        <Bell size={16} aria-hidden="true" />
      </button>
    </article>
  );
}
