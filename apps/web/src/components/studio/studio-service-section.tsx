import type React from "react";

import { STUDIO_SERVICE_LABELS } from "@snc/shared";
import type { StudioService } from "@snc/shared";

import styles from "./studio-service-section.module.css";

// ── Private Constants ──

const SERVICE_DETAILS: Record<
  StudioService,
  {
    description: string;
    features: readonly string[];
    rateRange: string;
  }
> = {
  recording: {
    description:
      "Professional recording in our acoustically treated live room and control room. Suitable for bands, solo artists, voiceover, and session work.",
    features: [
      "Live room + isolated control room",
      "Multi-track recording",
      "Basic mixing included",
      "Bring your own engineer or use ours",
    ],
    rateRange: "From $30/hr",
  },
  podcast: {
    description:
      "Dedicated podcast production setup with quality microphones, acoustic treatment, and post-production support.",
    features: [
      "Multi-mic setup for interviews",
      "Remote guest recording capability",
      "Editing and post-production available",
      "Recurring retainer packages",
    ],
    rateRange: "From $25/hr",
  },
  "practice-space": {
    description:
      "Rehearsal and practice space with backline available. Book by the hour or take out a monthly membership.",
    features: [
      "PA system included",
      "Backline available",
      "Hourly or membership rates",
      "Climate controlled",
    ],
    rateRange: "From $15/hr",
  },
  "venue-hire": {
    description:
      "Versatile event space for intimate gigs, listening parties, workshops, and community events.",
    features: [
      "Capacity up to 50",
      "PA and basic lighting",
      "Green room available",
      "Catering arrangements possible",
    ],
    rateRange: "From $150/half-day",
  },
};

// ── Public Types ──

export interface StudioServiceSectionProps {
  readonly service: StudioService;
}

// ── Public API ──

export function StudioServiceSection({
  service,
}: StudioServiceSectionProps): React.ReactElement {
  const label = STUDIO_SERVICE_LABELS[service];
  const details = SERVICE_DETAILS[service];

  return (
    <section className={styles.section} id={`service-${service}`}>
      <h2 className={styles.heading}>{label}</h2>
      <p className={styles.description}>{details.description}</p>
      <ul className={styles.features}>
        {details.features.map((feature) => (
          <li key={feature} className={styles.feature}>
            {feature}
          </li>
        ))}
      </ul>
      <p className={styles.rate}>{details.rateRange}</p>
    </section>
  );
}
