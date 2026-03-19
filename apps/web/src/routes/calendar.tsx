import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type React from "react";
import type { CalendarEvent, CalendarEventsResponse, FeedTokenResponse } from "@snc/shared";
import { DEFAULT_EVENT_TYPE_LABELS } from "@snc/shared";

import { ComingSoon } from "../components/coming-soon/coming-soon.js";
import { fetchAuthStateServer, fetchApiServer } from "../lib/api-server.js";
import { isFeatureEnabled } from "../lib/config.js";
import { fetchCalendarEvents, deleteCalendarEvent, fetchEventTypes } from "../lib/calendar.js";
import { EventList } from "../components/calendar/event-list.js";
import { EventForm } from "../components/calendar/event-form.js";
import { FeedUrlCard } from "../components/calendar/feed-url-card.js";
import listingStyles from "../styles/listing-page.module.css";
import styles from "./calendar.module.css";

// ── Private Types ──

export interface CalendarLoaderData {
  readonly events: CalendarEventsResponse;
  readonly feedToken: FeedTokenResponse | null;
}

// ── Route ──

export const Route = createFileRoute("/calendar")({
  beforeLoad: async () => {
    if (!isFeatureEnabled("calendar")) throw redirect({ to: "/" });

    const { user, roles } = await fetchAuthStateServer();

    if (!user) {
      throw redirect({ to: "/login" });
    }

    if (!roles.includes("stakeholder")) {
      throw redirect({ to: "/feed" });
    }
  },
  loader: async (): Promise<CalendarLoaderData> => {
    // Load current month's events
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [events, feedToken] = await Promise.all([
      fetchApiServer({
        data: `/api/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}`,
      }) as Promise<CalendarEventsResponse>,
      (fetchApiServer({ data: "/api/calendar/feed-token" }) as Promise<FeedTokenResponse>).catch(
        () => null,
      ),
    ]);

    return { events, feedToken };
  },
  component: CalendarPage,
});

// ── Component ──

function CalendarPage(): React.ReactElement {
  if (!isFeatureEnabled("calendar")) return <ComingSoon feature="calendar" />;

  const { events: initialEvents, feedToken } = Route.useLoaderData();

  const [events, setEvents] = useState<CalendarEvent[]>([...initialEvents.items]);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [eventTypeOptions, setEventTypeOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    fetchEventTypes()
      .then((res) => {
        setEventTypeOptions(
          res.items.map((et) => ({ value: et.slug, label: et.label })),
        );
      })
      .catch(() => {
        // Fallback to default labels
        setEventTypeOptions(
          Object.entries(DEFAULT_EVENT_TYPE_LABELS).map(([slug, label]) => ({
            value: slug,
            label,
          })),
        );
      });
  }, []);

  // ── Date range navigation ──
  const [monthOffset, setMonthOffset] = useState(0);

  const currentMonth = new Date();
  currentMonth.setMonth(currentMonth.getMonth() + monthOffset);
  const monthLabel = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const loadEvents = async () => {
    const from = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const to = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);

    try {
      const params: Record<string, string> = {
        from: from.toISOString(),
        to: to.toISOString(),
      };
      if (eventTypeFilter) params.eventType = eventTypeFilter;

      const result = await fetchCalendarEvents(params);
      setEvents(result.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load events");
    }
  };

  const handlePrev = () => {
    setMonthOffset((o) => o - 1);
    // Trigger reload after state update
    setTimeout(loadEvents, 0);
  };

  const handleNext = () => {
    setMonthOffset((o) => o + 1);
    setTimeout(loadEvents, 0);
  };

  const handleEventTypeChange = (value: string) => {
    setEventTypeFilter(value);
    setTimeout(loadEvents, 0);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingEvent(undefined);
    void loadEvents();
  };

  const handleEdit = (id: string) => {
    const event = events.find((e) => e.id === id);
    if (event) {
      setEditingEvent(event);
      setShowForm(true);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteCalendarEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete event");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleNewEvent = () => {
    setEditingEvent(undefined);
    setShowForm(true);
  };

  const filteredEvents = eventTypeFilter
    ? events.filter((e) => e.eventType === eventTypeFilter)
    : events;

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={listingStyles.heading}>Calendar</h1>
        <button
          type="button"
          className={styles.newEventButton}
          onClick={handleNewEvent}
        >
          New Event
        </button>
      </div>

      {error !== null && (
        <div className={styles.error} role="alert">{error}</div>
      )}

      {/* ── Date Range Nav ── */}
      <div className={styles.navRow}>
        <button type="button" className={styles.navButton} onClick={handlePrev}>
          Previous
        </button>
        <span className={styles.monthLabel}>{monthLabel}</span>
        <button type="button" className={styles.navButton} onClick={handleNext}>
          Next
        </button>
      </div>

      {/* ── Event Type Filter ── */}
      <div className={styles.filterRow}>
        <select
          value={eventTypeFilter}
          onChange={(e) => handleEventTypeChange(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="">All event types</option>
          {eventTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Event Form ── */}
      {showForm && (
        <div className={styles.formWrapper}>
          <EventForm
            event={editingEvent}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setShowForm(false);
              setEditingEvent(undefined);
            }}
          />
        </div>
      )}

      {/* ── Event List ── */}
      <EventList
        events={filteredEvents}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* ── Feed URL Card ── */}
      <div className={styles.feedSection}>
        <FeedUrlCard initialToken={feedToken ?? undefined} />
      </div>
    </div>
  );
}
