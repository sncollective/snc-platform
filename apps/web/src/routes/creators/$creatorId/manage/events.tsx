import { createFileRoute, getRouteApi, redirect } from "@tanstack/react-router";
import { useState } from "react";
import type React from "react";
import type { CalendarEvent, EventCategory } from "@snc/shared";

import { EventForm } from "../../../../components/calendar/event-form.js";
import { EventList } from "../../../../components/calendar/event-list.js";
import { isFeatureEnabled } from "../../../../lib/config.js";
import {
  fetchCreatorEvents,
  deleteCreatorEvent,
} from "../../../../lib/calendar.js";
import sectionStyles from "../../../../styles/detail-section.module.css";
import styles from "./events-manage.module.css";

// ── Private Constants ──

const CATEGORY_OPTIONS: { value: EventCategory; label: string }[] = [
  { value: "recording-session", label: "Recording" },
  { value: "album-milestone", label: "Milestone" },
  { value: "show", label: "Show" },
  { value: "meeting", label: "Meeting" },
];

// ── Route ──

const manageRoute = getRouteApi("/creators/$creatorId/manage");

export const Route = createFileRoute("/creators/$creatorId/manage/events")({
  beforeLoad: () => {
    if (!isFeatureEnabled("calendar")) throw redirect({ to: "/" });
  },
  component: ManageEventsPage,
});

// ── Component ──

function ManageEventsPage(): React.ReactElement {
  const { creator } = manageRoute.useLoaderData();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(
    undefined,
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ── Date range navigation ──
  const [monthOffset, setMonthOffset] = useState(0);

  const currentMonth = new Date();
  currentMonth.setMonth(currentMonth.getMonth() + monthOffset);
  const monthLabel = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const loadEvents = async () => {
    const from = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1,
    );
    const to = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    try {
      const params: Record<string, string> = {
        from: from.toISOString(),
        to: to.toISOString(),
      };
      if (categoryFilter) params.category = categoryFilter;

      const result = await fetchCreatorEvents(creator.id, params);
      setEvents(result.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load events");
    } finally {
      setIsLoading(false);
    }
  };

  // Load events on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: monthOffset drives currentMonth
  useState(() => {
    void loadEvents();
  });

  const handlePrev = () => {
    setMonthOffset((o) => o - 1);
    setTimeout(loadEvents, 0);
  };

  const handleNext = () => {
    setMonthOffset((o) => o + 1);
    setTimeout(loadEvents, 0);
  };

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
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
      await deleteCreatorEvent(creator.id, id);
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

  const filteredEvents = categoryFilter
    ? events.filter((e) => e.category === categoryFilter)
    : events;

  return (
    <div className={styles.eventsManage}>
      <section className={sectionStyles.section}>
        <div className={styles.headerRow}>
          <h2 className={sectionStyles.sectionHeading}>Events</h2>
          <button
            type="button"
            className={styles.newEventButton}
            onClick={handleNewEvent}
          >
            New Event
          </button>
        </div>

        {error !== null && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        {/* Month Navigation */}
        <div className={styles.navRow}>
          <button
            type="button"
            className={styles.navButton}
            onClick={handlePrev}
          >
            Previous
          </button>
          <span className={styles.monthLabel}>{monthLabel}</span>
          <button
            type="button"
            className={styles.navButton}
            onClick={handleNext}
          >
            Next
          </button>
        </div>

        {/* Category Filter */}
        <div className={styles.filterRow}>
          <select
            value={categoryFilter}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Event Form */}
        {showForm && (
          <div className={styles.formWrapper}>
            <EventForm
              event={editingEvent}
              creatorId={creator.id}
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setShowForm(false);
                setEditingEvent(undefined);
              }}
            />
          </div>
        )}

        {/* Event List */}
        {isLoading ? (
          <p className={styles.status}>Loading events...</p>
        ) : (
          <EventList
            events={filteredEvents}
            onEdit={handleEdit}
            {...(!isDeleting && { onDelete: (id: string) => { void handleDelete(id); } })}
          />
        )}
      </section>
    </div>
  );
}
