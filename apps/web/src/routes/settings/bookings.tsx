import { createFileRoute, redirect } from "@tanstack/react-router";
import type React from "react";
import type { BookingWithService } from "@snc/shared";

import { fetchAuthStateServer } from "../../lib/api-server.js";
import { isFeatureEnabled } from "../../lib/config.js";
import { useCursorPagination } from "../../hooks/use-cursor-pagination.js";
import { BookingList } from "../../components/booking/booking-list.js";
import errorStyles from "../../styles/error-alert.module.css";
import listingStyles from "../../styles/listing-page.module.css";
import settingsStyles from "../../styles/settings-page.module.css";

export const Route = createFileRoute("/settings/bookings")({
  beforeLoad: async () => {
    if (!isFeatureEnabled("booking")) throw redirect({ to: "/" });

    const { user } = await fetchAuthStateServer();
    if (!user) {
      throw redirect({ to: "/login" });
    }
  },
  component: BookingManagementPage,
});

function buildMyBookingsUrl(cursor: string | null): string {
  const params = new URLSearchParams();
  params.set("limit", "20");
  if (cursor) {
    params.set("cursor", cursor);
  }
  return `/api/bookings/mine?${params.toString()}`;
}

function BookingManagementPage(): React.ReactElement {
  const { items, nextCursor, isLoading, error, loadMore } =
    useCursorPagination<BookingWithService>({
      buildUrl: buildMyBookingsUrl,
      fetchOptions: { credentials: "include" },
    });

  return (
    <div className={settingsStyles.page}>
      <h1 className={listingStyles.heading}>My Booking Requests</h1>

      {error !== null && (
        <div className={errorStyles.error} role="alert">
          {error}
        </div>
      )}

      {isLoading && items.length === 0 ? (
        <p className={listingStyles.status}>Loading booking requests...</p>
      ) : (
        <>
          <BookingList bookings={items} />
          {nextCursor !== null && (
            <div className={listingStyles.loadMoreWrapper}>
              <button
                className={listingStyles.loadMoreButton}
                onClick={loadMore}
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
