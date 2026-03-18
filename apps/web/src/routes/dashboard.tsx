import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import type React from "react";
import type {
  RevenueResponse,
  SubscriberSummary,
  BookingSummary,
  EmissionsSummary,
  PendingBookingItem,
  ReviewBookingRequest,
} from "@snc/shared";

import { fetchApiServer, fetchAuthStateServer } from "../lib/api-server.js";
import { isFeatureEnabled } from "../lib/config.js";
import { reviewBooking } from "../lib/dashboard.js";
import { formatPrice, formatCo2 } from "../lib/format.js";
import { useCursorPagination } from "../hooks/use-cursor-pagination.js";
import { KpiCard } from "../components/dashboard/kpi-card.js";
import { RevenueChart } from "../components/dashboard/revenue-chart.js";
import { PendingBookingsTable } from "../components/dashboard/pending-bookings-table.js";
import sectionStyles from "../styles/detail-section.module.css";
import errorStyles from "../styles/error-alert.module.css";
import listingStyles from "../styles/listing-page.module.css";
import pageHeadingStyles from "../styles/page-heading.module.css";
import styles from "./dashboard.module.css";

// ── Private Types ──

export interface DashboardLoaderData {
  readonly revenue: RevenueResponse;
  readonly subscribers: SubscriberSummary;
  readonly bookingSummary: BookingSummary;
  readonly emissionsSummary: EmissionsSummary;
}

// ── Route ──

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    if (!isFeatureEnabled("dashboard")) throw redirect({ to: "/" });

    const { user, roles } = await fetchAuthStateServer();

    if (!user) {
      throw redirect({ to: "/login" });
    }

    if (!roles.includes("stakeholder")) {
      throw redirect({ to: "/feed" });
    }
  },
  loader: async (): Promise<DashboardLoaderData> => {
    const [revenue, subscribers, bookingSummary, emissionsSummary] =
      await Promise.all([
        fetchApiServer({ data: "/api/dashboard/revenue" }) as Promise<RevenueResponse>,
        fetchApiServer({ data: "/api/dashboard/subscribers" }) as Promise<SubscriberSummary>,
        fetchApiServer({ data: "/api/dashboard/bookings" }) as Promise<BookingSummary>,
        fetchApiServer({ data: "/api/emissions/summary" }) as Promise<EmissionsSummary>,
      ]);

    return { revenue, subscribers, bookingSummary, emissionsSummary };
  },
  component: DashboardPage,
});

// ── Component ──

function DashboardPage(): React.ReactElement {
  const { revenue, subscribers, bookingSummary, emissionsSummary } =
    Route.useLoaderData();

  // ── Pending Bookings (cursor-paginated) ──
  const {
    items: pendingBookings,
    nextCursor,
    isLoading: bookingsLoading,
    error: bookingsError,
    loadMore,
  } = useCursorPagination<PendingBookingItem>({
    buildUrl: (cursor) => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      params.set("limit", "20");
      return `/api/bookings/pending?${params.toString()}`;
    },
    fetchOptions: { credentials: "include" },
  });

  // ── Review State ──
  const [reviewingId, setReviewingId] = useState<string | undefined>(undefined);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // ── Local mutable ref for bookings we track client-side ──
  // We maintain a separate list that filters out reviewed bookings
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [pendingAdjustment, setPendingAdjustment] = useState(0);

  const visibleBookings = pendingBookings.filter((b) => !removedIds.has(b.id));

  // ── Review Handler ──
  const handleReview = async (
    id: string,
    data: ReviewBookingRequest,
  ): Promise<void> => {
    setReviewingId(id);
    setReviewError(null);

    try {
      await reviewBooking(id, data);
      setRemovedIds((prev) => new Set(prev).add(id));
      setPendingAdjustment((prev) => prev + 1);
    } catch (e) {
      setReviewError(
        e instanceof Error ? e.message : "Failed to review booking",
      );
    } finally {
      setReviewingId(undefined);
    }
  };

  // ── Derived KPI Values ──
  const revenueValue = formatPrice(revenue.currentMonth);
  const subscriberValue = String(subscribers.active);
  const pendingValue = String(Math.max(0, bookingSummary.pending - pendingAdjustment));
  const co2Value = formatCo2(emissionsSummary.netCo2Kg);

  return (
    <div className={styles.page}>
      <h1 className={pageHeadingStyles.heading}>Dashboard</h1>

      {/* ── KPI Cards ── */}
      <div className={styles.kpiRow}>
        <KpiCard
          label="Revenue This Month"
          value={revenueValue}
          sublabel="from subscriptions"
        />
        <KpiCard
          label="Active Subscribers"
          value={subscriberValue}
        />
        <KpiCard
          label="Pending Bookings"
          value={pendingValue}
        />
        <KpiCard
          label="Total CO2"
          value={co2Value}
          sublabel="estimated emissions"
        />
      </div>

      {/* ── Revenue Chart Section ── */}
      <section className={sectionStyles.section}>
        <h2 className={sectionStyles.sectionHeading}>Revenue Over Time</h2>
        <RevenueChart
          data={revenue.monthly}
        />
      </section>

      {/* ── Pending Bookings Section ── */}
      <section className={sectionStyles.section}>
        <h2 className={sectionStyles.sectionHeading}>Pending Booking Requests</h2>

        {reviewError !== null && (
          <div className={errorStyles.error} role="alert">{reviewError}</div>
        )}

        {bookingsLoading && visibleBookings.length === 0 ? (
          <p className={listingStyles.status}>Loading booking requests...</p>
        ) : bookingsError !== null && visibleBookings.length === 0 ? (
          <div className={errorStyles.error} role="alert">{bookingsError}</div>
        ) : (
          <>
            <PendingBookingsTable
              bookings={visibleBookings}
              onReview={handleReview}
              reviewingId={reviewingId}
            />
            {nextCursor !== null && (
              <div className={listingStyles.loadMoreWrapper}>
                <button
                  type="button"
                  className={listingStyles.loadMoreButton}
                  onClick={loadMore}
                  disabled={bookingsLoading}
                >
                  {bookingsLoading ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
