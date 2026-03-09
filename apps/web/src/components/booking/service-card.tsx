import type React from "react";
import type { Service } from "@snc/shared";

import buttonStyles from "../../styles/button.module.css";
import styles from "./service-card.module.css";

// ── Public Types ──

export interface ServiceCardProps {
  readonly service: Service;
  readonly onRequestBooking: (serviceId: string) => void;
}

// ── Public API ──

export function ServiceCard({
  service,
  onRequestBooking,
}: ServiceCardProps): React.ReactElement {
  return (
    <div className={styles.card}>
      <div className={styles.content}>
        <h3 className={styles.name}>{service.name}</h3>
        <p className={styles.description}>{service.description}</p>
        <span className={styles.pricing}>{service.pricingInfo}</span>
      </div>
      <button
        type="button"
        className={`${buttonStyles.primaryButton} ${styles.bookButton}`}
        onClick={() => onRequestBooking(service.id)}
      >
        Request Booking
      </button>
    </div>
  );
}
