import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type React from "react";
import type {
  RevenueResponse,
  SubscriberSummary,
  BookingSummary,
  EmissionsSummary,
  PendingBookingItem,
  ReviewBookingRequest,
} from "@snc/shared";

import { fetchAuthStateServer } from "../lib/api-server.js";
import {
  fetchRevenue,
  fetchSubscribers,
  fetchBookingSummary,
  reviewBooking,
} from "../lib/dashboard.js";
import { formatPrice, formatCo2 } from "../lib/format.js";
import { fetchEmissionsSummary } from "../lib/emissions.js";
import { useCursorPagination } from "../hooks/use-cursor-pagination.js";
import { KpiCard } from "../components/dashboard/kpi-card.js";
import { RevenueChart } from "../components/dashboard/revenue-chart.js";
import { PendingBookingsTable } from "../components/dashboard/pending-bookings-table.js";
import styles from "./dashboard.module.css";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const { user, roles } = await fetchAuthStateServer();

    if (!user) {
      throw redirect({ to: "/login" });
    }

    if (!roles.includes("cooperative-member")) {
      throw redirect({ to: "/feed" });
    }
  },
  component: DashboardPage,
});

function DashboardPage(): React.ReactElement {
  // ── KPI State ──
  const [revenue, setRevenue] = useState<RevenueResponse | null>(null);
  const [subscribers, setSubscribers] = useState<SubscriberSummary | null>(null);
  const [bookingSummary, setBookingSummary] = useState<BookingSummary | null>(null);
  const [emissionsSummary, setEmissionsSummary] = useState<EmissionsSummary | null>(null);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);

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

  // ── Load KPI Data ──
  useEffect(() => {
    let cancelled = false;

    async function loadKpis(): Promise<void> {
      setKpiLoading(true);
      setKpiError(null);

      try {
        const [revenueResult, subscribersResult, bookingResult, emissionsResult] =
          await Promise.all([
            fetchRevenue(),
            fetchSubscribers(),
            fetchBookingSummary(),
            fetchEmissionsSummary(),
          ]);

        if (!cancelled) {
          setRevenue(revenueResult);
          setSubscribers(subscribersResult);
          setBookingSummary(bookingResult);
          setEmissionsSummary(emissionsResult);
        }
      } catch (e) {
        if (!cancelled) {
          setKpiError(e instanceof Error ? e.message : "Failed to load dashboard data");
        }
      } finally {
        if (!cancelled) {
          setKpiLoading(false);
        }
      }
    }

    void loadKpis();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Review Handler ──
  const handleReview = useCallback(
    async (id: string, data: ReviewBookingRequest): Promise<void> => {
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
    },
    [],
  );

  // ── Derived KPI Values ──
  const revenueValue = revenue !== null
    ? formatPrice(revenue.currentMonth)
    : "—";
  const subscriberValue = subscribers !== null
    ? String(subscribers.active)
    : "—";
  const pendingValue = bookingSummary !== null
    ? String(Math.max(0, bookingSummary.pending - pendingAdjustment))
    : "—";
  const co2Value = emissionsSummary !== null
    ? formatCo2(emissionsSummary.totalCo2Kg)
    : "—";

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Dashboard</h1>

      {/* ── KPI Error ── */}
      {kpiError !== null && (
        <div className={styles.error} role="alert">{kpiError}</div>
      )}

      {/* ── KPI Cards ── */}
      <div className={styles.kpiRow}>
        <KpiCard
          label="Revenue This Month"
          value={revenueValue}
          sublabel="from subscriptions"
          isLoading={kpiLoading}
        />
        <KpiCard
          label="Active Subscribers"
          value={subscriberValue}
          isLoading={kpiLoading}
        />
        <KpiCard
          label="Pending Bookings"
          value={pendingValue}
          isLoading={kpiLoading}
        />
        <KpiCard
          label="Total CO2"
          value={co2Value}
          sublabel="estimated emissions"
          isLoading={kpiLoading}
        />
      </div>

      {/* ── Revenue Chart Section ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Revenue Over Time</h2>
        <RevenueChart
          data={revenue?.monthly ?? []}
          isLoading={kpiLoading}
        />
      </section>

      {/* ── Pending Bookings Section ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Pending Booking Requests</h2>

        {reviewError !== null && (
          <div className={styles.error} role="alert">{reviewError}</div>
        )}

        {bookingsLoading && visibleBookings.length === 0 ? (
          <p className={styles.status}>Loading booking requests...</p>
        ) : bookingsError !== null && visibleBookings.length === 0 ? (
          <div className={styles.error} role="alert">{bookingsError}</div>
        ) : (
          <>
            <PendingBookingsTable
              bookings={visibleBookings}
              onReview={handleReview}
              reviewingId={reviewingId}
            />
            {nextCursor !== null && (
              <div className={styles.loadMoreWrapper}>
                <button
                  type="button"
                  className={styles.loadMoreButton}
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
