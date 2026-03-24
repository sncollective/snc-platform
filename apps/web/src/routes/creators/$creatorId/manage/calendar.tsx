import { createFileRoute, getRouteApi, redirect } from "@tanstack/react-router";
import type React from "react";

import { EventForm } from "../../../../components/calendar/event-form.js";
import { CalendarGrid } from "../../../../components/calendar/calendar-grid.js";
import { TimelineView } from "../../../../components/calendar/timeline-view.js";
import { ViewToggle } from "../../../../components/calendar/view-toggle.js";
import { isFeatureEnabled } from "../../../../lib/config.js";
import { useCalendarState } from "../../../../hooks/use-calendar-state.js";
import sectionStyles from "../../../../styles/detail-section.module.css";
import styles from "./calendar-manage.module.css";

// ── Route ──

const manageRoute = getRouteApi("/creators/$creatorId/manage");

export const Route = createFileRoute("/creators/$creatorId/manage/calendar")({
  beforeLoad: () => {
    if (!isFeatureEnabled("calendar")) throw redirect({ to: "/" });
  },
  component: ManageCalendarPage,
});

// ── Component ──

function ManageCalendarPage(): React.ReactElement {
  const { creator } = manageRoute.useLoaderData();

  const cal = useCalendarState({ creatorId: creator.id });

  return (
    <div className={styles.calendarManage}>
      <section className={sectionStyles.section}>
        <div className={styles.headerRow}>
          <h2 className={sectionStyles.sectionHeading}>Calendar</h2>
          <button
            type="button"
            className={styles.newEventButton}
            onClick={cal.handleNewEvent}
          >
            New Event
          </button>
        </div>

        {cal.error !== null && (
          <div className={styles.error} role="alert">
            {cal.error}
          </div>
        )}

        {/* View Toggle */}
        <ViewToggle activeView={cal.viewMode} onViewChange={cal.setViewMode} />

        {/* Filters */}
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
            value={cal.projectFilter}
            onChange={(e) => cal.setProjectFilter(e.target.value)}
            className={styles.filterSelect}
            aria-label="Filter by project"
          >
            <option value="">All projects</option>
            {cal.projectOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Event Form */}
        {cal.showForm && (
          <div className={styles.formWrapper}>
            <EventForm
              event={cal.editingEvent}
              creatorId={creator.id}
              defaultProjectId={cal.projectFilter || undefined}
              defaultEventType={cal.eventTypeFilter || undefined}
              onSuccess={cal.handleFormSuccess}
              onCancel={cal.handleFormCancel}
              onDeleted={cal.handleFormDeleted}
            />
          </div>
        )}

        {/* Month View */}
        {cal.viewMode === "month" && (
          <>
            <div className={styles.navRow}>
              <button
                type="button"
                className={styles.navButton}
                onClick={cal.handlePrev}
              >
                Previous
              </button>
              <span className={styles.monthLabel}>{cal.monthLabel}</span>
              <button
                type="button"
                className={styles.navButton}
                onClick={cal.handleNext}
              >
                Next
              </button>
            </div>
            <CalendarGrid
              events={cal.events}
              year={cal.currentYear}
              month={cal.currentMonthIndex}
              onEventClick={cal.handleEdit}
            />
          </>
        )}

        {/* Timeline View */}
        {cal.viewMode === "timeline" && (
          <TimelineView
            eventTypeFilter={cal.eventTypeFilter}
            creatorFilter=""
            projectFilter={cal.projectFilter}
            creatorId={creator.id}
            onEdit={cal.handleEdit}
            onDelete={(id) => { void cal.handleDelete(id); }}
          />
        )}
      </section>
    </div>
  );
}
