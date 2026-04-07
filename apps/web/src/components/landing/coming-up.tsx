import type React from "react";
import { Calendar } from "lucide-react";
import type { UpcomingEventsResponse } from "@snc/shared";

import { EventCard } from "./event-card.js";
import sectionStyles from "../../styles/landing-section.module.css";
import styles from "./coming-up.module.css";

// ── Public API ──

export interface ComingUpProps {
  readonly events: UpcomingEventsResponse["items"];
}

/** Render the "Coming Up" section with upcoming public events. */
export function ComingUp({ events }: ComingUpProps): React.ReactElement {
  if (events.length === 0) {
    return (
      <section className={sectionStyles.section}>
        <h2 className={sectionStyles.heading}>Coming Up</h2>
        <div className={sectionStyles.empty}>
          <Calendar size={32} aria-hidden="true" />
          <p>No upcoming events — stay tuned!</p>
        </div>
      </section>
    );
  }

  return (
    <section className={sectionStyles.section}>
      <h2 className={sectionStyles.heading}>Coming Up</h2>
      <div className={styles.eventList}>
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}
