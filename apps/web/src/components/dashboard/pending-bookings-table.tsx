import { useState } from "react";
import type React from "react";
import type { PendingBookingItem, ReviewBookingRequest } from "@snc/shared";

import { formatRelativeDate } from "../../lib/format.js";
import styles from "./pending-bookings-table.module.css";

// ── Public Types ──

export interface PendingBookingsTableProps {
  readonly bookings: readonly PendingBookingItem[];
  readonly onReview: (id: string, data: ReviewBookingRequest) => Promise<void>;
  readonly reviewingId?: string | undefined;
}

// ── Private Helpers ──

function formatPreferredDates(dates: readonly string[]): {
  display: string;
  title: string;
} {
  if (dates.length === 0) return { display: "None", title: "None" };
  const first = dates[0] ?? "";
  const display =
    dates.length === 1 ? first : `${first} (+${dates.length - 1} more)`;
  return { display, title: dates.join(", ") };
}

// ── Public API ──

export function PendingBookingsTable({
  bookings,
  onReview,
  reviewingId,
}: PendingBookingsTableProps): React.ReactElement {
  const [denyingId, setDenyingId] = useState<string | null>(null);
  const [denyNote, setDenyNote] = useState("");

  if (bookings.length === 0) {
    return <div className={styles.empty}>No pending booking requests</div>;
  }

  function handleApprove(id: string): void {
    void onReview(id, { status: "approved" });
  }

  function handleDenyClick(id: string): void {
    setDenyingId(id);
    setDenyNote("");
  }

  function handleCancelDeny(): void {
    setDenyingId(null);
    setDenyNote("");
  }

  function handleConfirmDeny(id: string): void {
    const data: ReviewBookingRequest = {
      status: "denied",
      ...(denyNote.trim() !== "" ? { reviewNote: denyNote.trim() } : {}),
    };
    void onReview(id, data);
    setDenyingId(null);
    setDenyNote("");
  }

  function renderActions(booking: PendingBookingItem): React.ReactElement {
    const isReviewing = reviewingId === booking.id;

    if (denyingId === booking.id) {
      return (
        <div className={styles.denyForm}>
          <input
            type="text"
            className={styles.denyInput}
            placeholder="Review note (optional)"
            value={denyNote}
            onChange={(e) => setDenyNote(e.target.value)}
            disabled={isReviewing}
            aria-label="Review note"
          />
          <button
            type="button"
            className={styles.confirmDenyButton}
            onClick={() => handleConfirmDeny(booking.id)}
            disabled={isReviewing}
          >
            Confirm
          </button>
          <button
            type="button"
            className={styles.cancelDenyButton}
            onClick={handleCancelDeny}
            disabled={isReviewing}
          >
            Cancel
          </button>
        </div>
      );
    }

    return (
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.approveButton}
          onClick={() => handleApprove(booking.id)}
          disabled={isReviewing}
        >
          Approve
        </button>
        <button
          type="button"
          className={styles.denyButton}
          onClick={() => handleDenyClick(booking.id)}
          disabled={isReviewing}
        >
          Deny
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table layout */}
      <table className={styles.table}>
        <thead>
          <tr className={styles.headerRow}>
            <th>Requester</th>
            <th>Service</th>
            <th>Preferred Dates</th>
            <th>Submitted</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => {
            const dates = formatPreferredDates(booking.preferredDates);
            return (
              <tr key={booking.id} className={styles.row}>
                <td>{booking.requester.name}</td>
                <td>{booking.service.name}</td>
                <td title={dates.title}>{dates.display}</td>
                <td>{formatRelativeDate(booking.createdAt)}</td>
                <td>{renderActions(booking)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile card layout */}
      <div className={styles.cardList}>
        {bookings.map((booking) => {
          const dates = formatPreferredDates(booking.preferredDates);
          return (
            <div key={`card-${booking.id}`} className={styles.card}>
              <div className={styles.cardField}>
                <span className={styles.cardLabel}>Requester</span>
                <span className={styles.cardValue}>
                  {booking.requester.name}
                </span>
              </div>
              <div className={styles.cardField}>
                <span className={styles.cardLabel}>Service</span>
                <span className={styles.cardValue}>
                  {booking.service.name}
                </span>
              </div>
              <div className={styles.cardField}>
                <span className={styles.cardLabel}>Dates</span>
                <span className={styles.cardValue} title={dates.title}>
                  {dates.display}
                </span>
              </div>
              <div className={styles.cardField}>
                <span className={styles.cardLabel}>Submitted</span>
                <span className={styles.cardValue}>
                  {formatRelativeDate(booking.createdAt)}
                </span>
              </div>
              <div className={styles.cardActions}>
                {renderActions(booking)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
