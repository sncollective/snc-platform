import { createFileRoute } from "@tanstack/react-router";
import type React from "react";
import type { CalendarEventsResponse, FeedTokenResponse } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { fetchApiServer } from "../../lib/api-server.js";
import { ssrLogger } from "../../lib/logger.js";
import { EventForm } from "../../components/calendar/event-form.js";
import { FeedUrlCard } from "../../components/calendar/feed-url-card.js";
import { ViewToggle } from "../../components/calendar/view-toggle.js";
import { CalendarGrid } from "../../components/calendar/calendar-grid.js";
import { TimelineView } from "../../components/calendar/timeline-view.js";
import { useCalendarState } from "../../hooks/use-calendar-state.js";
import listingStyles from "../../styles/listing-page.module.css";
import styles from "../calendar.module.css";

// ── Route Types ──

export interface CalendarLoaderData {
  readonly events: CalendarEventsResponse;
  readonly feedToken: FeedTokenResponse | null;
}

// ── Route ──

export const Route = createFileRoute("/governance/calendar")({
  head: () => ({
    meta: [{ title: "Calendar — S/NC" }],
  }),
  errorComponent: RouteErrorBoundary,
  loader: async (): Promise<CalendarLoaderData> => {
    // Load current month's events
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 0); // day before month start
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1, 23, 59, 59); // day after month end

    const [events, feedToken] = await Promise.all([
      fetchApiServer({
        data: `/api/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}`,
      }) as Promise<CalendarEventsResponse>,
      (fetchApiServer({ data: "/api/calendar/feed-token" }) as Promise<FeedTokenResponse>).catch(
        (e: unknown) => {
          ssrLogger.warn({ error: e instanceof Error ? e.message : String(e) }, "Failed to load calendar feed token");
          return null;
        },
      ),
    ]);

    return { events, feedToken };
  },
  component: CalendarPage,
});

// ── Component ──

function CalendarPage(): React.ReactElement {
  const { events: initialEvents, feedToken } = Route.useLoaderData();

  const cal = useCalendarState({
    includeCreatorFilter: true,
    initialEvents: initialEvents.items,
  });


  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={listingStyles.heading}>Calendar</h1>
        <button
          type="button"
          className={styles.newEventButton}
          onClick={cal.handleNewEvent}
        >
          New Event
        </button>
      </div>

      {cal.error !== null && (
        <div className={styles.error} role="alert">{cal.error}</div>
      )}

      {/* ── View Toggle ── */}
      <ViewToggle activeView={cal.viewMode} onViewChange={cal.setViewMode} />

      {/* ── Filters ── */}
      <div className={styles.filterRow}>
        <select
          value={cal.eventTypeFilter}
          onChange={(e) => cal.setEventTypeFilter(e.target.value)}
          className={styles.filterSelect}
          aria-label="Filter by event type"
        >
          <option value="">All event types</option>
          {cal.eventTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={cal.creatorFilter}
          onChange={(e) => { cal.handleCreatorChange(e.target.value); }}
          className={styles.filterSelect}
          aria-label="Filter by creator"
        >
          <option value="">All creators</option>
          {cal.creatorOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={cal.projectFilter}
          onChange={(e) => { cal.setProjectFilter(e.target.value); }}
          className={styles.filterSelect}
          aria-label="Filter by project"
        >
          <option value="">All projects</option>
          {cal.projectOptions.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* ── Event Form ── */}
      {cal.showForm && (
        <div className={styles.formWrapper}>
          <EventForm
            event={cal.editingEvent}
            creatorId={cal.creatorFilter || undefined}
            defaultProjectId={cal.projectFilter || undefined}
            defaultEventType={cal.eventTypeFilter || undefined}
            creatorOptions={cal.creatorOptions}
            onSuccess={cal.handleFormSuccess}
            onCancel={cal.handleFormCancel}
            onDeleted={cal.handleFormDeleted}
          />
        </div>
      )}

      {/* ── Month View ── */}
      {cal.viewMode === "month" && (
        <>
          <div className={styles.navRow}>
            <button type="button" className={styles.navButton} onClick={cal.handlePrev}>Previous</button>
            <span className={styles.monthLabel}>{cal.monthLabel}</span>
            <button type="button" className={styles.navButton} onClick={cal.handleNext}>Next</button>
          </div>
          <CalendarGrid
            events={cal.events}
            year={cal.currentYear}
            month={cal.currentMonthIndex}
            onEventClick={cal.handleEdit}
          />
        </>
      )}

      {/* ── Timeline View ── */}
      {cal.viewMode === "timeline" && (
        <TimelineView
          eventTypeFilter={cal.eventTypeFilter}
          creatorFilter={cal.creatorFilter}
          projectFilter={cal.projectFilter}
          onEdit={cal.handleEdit}
          onDelete={(id) => { void cal.handleDelete(id); }}
          onToggleComplete={(id) => { void cal.handleToggleComplete(id); }}
        />
      )}

      {/* ── Feed URL Card ── */}
      <div className={styles.feedSection}>
        <FeedUrlCard initialToken={feedToken ?? undefined} />
      </div>
    </div>
  );
}
