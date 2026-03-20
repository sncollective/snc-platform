import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import type React from "react";
import type { CalendarEvent, CalendarEventsResponse, FeedTokenResponse } from "@snc/shared";
import { DEFAULT_EVENT_TYPE_LABELS } from "@snc/shared";

import { ComingSoon } from "../components/coming-soon/coming-soon.js";
import { fetchAuthStateServer, fetchApiServer } from "../lib/api-server.js";
import { isFeatureEnabled } from "../lib/config.js";
import { fetchCalendarEvents, deleteCalendarEvent, fetchEventTypes, toggleEventComplete } from "../lib/calendar.js";
import { fetchProjects } from "../lib/project.js";
import { apiGet } from "../lib/fetch-utils.js";
import { EventForm } from "../components/calendar/event-form.js";
import { FeedUrlCard } from "../components/calendar/feed-url-card.js";
import { ViewToggle } from "../components/calendar/view-toggle.js";
import type { CalendarViewMode } from "../components/calendar/view-toggle.js";
import { CalendarGrid } from "../components/calendar/calendar-grid.js";
import { TimelineView } from "../components/calendar/timeline-view.js";
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
    const from = new Date(now.getFullYear(), now.getMonth(), 0); // day before month start
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1, 23, 59, 59); // day after month end

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
  const [creatorFilter, setCreatorFilter] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [eventTypeOptions, setEventTypeOptions] = useState<{ value: string; label: string }[]>([]);
  const [creatorOptions, setCreatorOptions] = useState<{ id: string; name: string }[]>([]);
  const [projectOptions, setProjectOptions] = useState<{ id: string; name: string }[]>([]);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [reloadKey, setReloadKey] = useState(0);
  const hasLoaderData = useRef(true);

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

  // Creator options — fetch once
  useEffect(() => {
    apiGet<{ items: { id: string; displayName: string }[] }>("/api/creators")
      .then((res) => {
        setCreatorOptions(res.items.map((c) => ({ id: c.id, name: c.displayName })));
      })
      .catch(() => {});
  }, []);

  // Projects — re-fetch when creator filter changes
  useEffect(() => {
    const params: Record<string, string> = { completed: "false" };
    if (creatorFilter) params.creatorId = creatorFilter;

    fetchProjects(params)
      .then((res) => {
        setProjectOptions(res.items.map((p) => ({ id: p.id, name: p.name })));
      })
      .catch(() => {});
  }, [creatorFilter]);

  // ── Date range navigation ──
  const [monthOffset, setMonthOffset] = useState(0);

  // Derive display values from monthOffset (no mutation)
  const monthLabel = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  })();

  const currentYear = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d.getFullYear();
  })();

  const currentMonthIndex = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d.getMonth();
  })();

  useEffect(() => {
    if (viewMode === "timeline") return;

    // Skip the initial client-side fetch — SSR loader already provided current month data
    if (hasLoaderData.current && monthOffset === 0 && !eventTypeFilter && !creatorFilter && !projectFilter) {
      hasLoaderData.current = false;
      return;
    }
    hasLoaderData.current = false;

    // Derive date range from monthOffset directly
    const ref = new Date();
    ref.setMonth(ref.getMonth() + monthOffset);
    const from = new Date(ref.getFullYear(), ref.getMonth(), 0);
    const to = new Date(ref.getFullYear(), ref.getMonth() + 1, 1, 23, 59, 59);

    const params: Record<string, string> = {
      from: from.toISOString(),
      to: to.toISOString(),
    };
    if (eventTypeFilter) params.eventType = eventTypeFilter;
    if (creatorFilter) params.creatorId = creatorFilter;
    if (projectFilter) params.projectId = projectFilter;

    let cancelled = false;
    fetchCalendarEvents(params)
      .then((result) => {
        if (!cancelled) setEvents(result.items);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load events");
      });

    return () => { cancelled = true; };
  }, [monthOffset, eventTypeFilter, creatorFilter, projectFilter, viewMode, reloadKey]);

  const handlePrev = () => {
    setMonthOffset((o) => o - 1);
  };

  const handleNext = () => {
    setMonthOffset((o) => o + 1);
  };

  const handleEventTypeChange = (value: string) => {
    setEventTypeFilter(value);
  };

  const handleCreatorChange = (value: string) => {
    setCreatorFilter(value);
    setProjectFilter("");
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingEvent(undefined);
    setReloadKey((k) => k + 1);
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

  const handleToggleComplete = async (id: string) => {
    setError(null);
    try {
      const updated = await toggleEventComplete(id);
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? updated : e)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update task");
    }
  };

  const handleNewEvent = () => {
    setEditingEvent(undefined);
    setShowForm(true);
  };

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

      {/* ── View Toggle ── */}
      <ViewToggle activeView={viewMode} onViewChange={setViewMode} />

      {/* ── Filters ── */}
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
        <select
          value={creatorFilter}
          onChange={(e) => { handleCreatorChange(e.target.value); }}
          className={styles.filterSelect}
        >
          <option value="">All creators</option>
          {creatorOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={projectFilter}
          onChange={(e) => { setProjectFilter(e.target.value); }}
          className={styles.filterSelect}
        >
          <option value="">All projects</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* ── Event Form ── */}
      {showForm && (
        <div className={styles.formWrapper}>
          <EventForm
            event={editingEvent}
            creatorId={creatorFilter || undefined}
            defaultProjectId={projectFilter || undefined}
            defaultEventType={eventTypeFilter || undefined}
            creatorOptions={creatorOptions}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setShowForm(false);
              setEditingEvent(undefined);
            }}
            onDeleted={() => {
              if (editingEvent) {
                setEvents((prev) => prev.filter((e) => e.id !== editingEvent.id));
              }
              setShowForm(false);
              setEditingEvent(undefined);
            }}
          />
        </div>
      )}

      {/* ── Month View ── */}
      {viewMode === "month" && (
        <>
          <div className={styles.navRow}>
            <button type="button" className={styles.navButton} onClick={handlePrev}>Previous</button>
            <span className={styles.monthLabel}>{monthLabel}</span>
            <button type="button" className={styles.navButton} onClick={handleNext}>Next</button>
          </div>
          <CalendarGrid
            events={events}
            year={currentYear}
            month={currentMonthIndex}
            onEventClick={handleEdit}
          />
        </>
      )}

      {/* ── Timeline View ── */}
      {viewMode === "timeline" && (
        <TimelineView
          eventTypeFilter={eventTypeFilter}
          creatorFilter={creatorFilter}
          projectFilter={projectFilter}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleComplete={(id) => { void handleToggleComplete(id); }}
        />
      )}

      {/* ── Feed URL Card ── */}
      <div className={styles.feedSection}>
        <FeedUrlCard initialToken={feedToken ?? undefined} />
      </div>
    </div>
  );
}
