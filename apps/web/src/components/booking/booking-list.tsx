import type React from "react";
import type { BookingWithService } from "@snc/shared";

import { formatRelativeDate } from "../../lib/format.js";
import listItemStyles from "../../styles/list-items.module.css";
import styles from "./booking-list.module.css";

// ── Public Types ──

export interface BookingListProps {
  readonly bookings: readonly BookingWithService[];
}

// ── Private Helpers ──

function getStatusClass(status: string): string {
  if (status === "approved") return styles.statusApproved!;
  if (status === "denied") return styles.statusDenied!;
  return styles.statusPending!;
}

// ── Public API ──

export function BookingList({
  bookings,
}: BookingListProps): React.ReactElement {
  if (bookings.length === 0) {
    return (
      <div className={listItemStyles.empty}>
        <p className={listItemStyles.emptyText}>
          You haven't submitted any booking requests yet.
        </p>
      </div>
    );
  }

  return (
    <div className={listItemStyles.list}>
      {bookings.map((booking) => (
        <div key={booking.id} className={listItemStyles.item}>
          <div className={listItemStyles.itemHeader}>
            <h3 className={styles.serviceName}>{booking.service.name}</h3>
            <span
              className={`${listItemStyles.statusBadge} ${styles.status} ${getStatusClass(booking.status)}`}
            >
              {booking.status}
            </span>
          </div>
          <div className={styles.dates}>
            {booking.preferredDates.join(", ")}
          </div>
          {booking.notes !== "" && (
            <div className={styles.notes}>{booking.notes}</div>
          )}
          <div className={styles.submittedDate}>
            Submitted {formatRelativeDate(booking.createdAt)}
          </div>
        </div>
      ))}
    </div>
  );
}
