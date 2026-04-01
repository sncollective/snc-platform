import type React from "react";
import { useState } from "react";
import { createFileRoute, Link, getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";

import type { Project, CalendarEvent, CalendarEventsResponse } from "@snc/shared";

import { RouteErrorBoundary } from "../../../../../components/error/route-error-boundary.js";
import { fetchApiServer } from "../../../../../lib/api-server.js";
import {
  updateProject,
  deleteProject,
} from "../../../../../lib/project.js";
import { toggleEventComplete } from "../../../../../lib/calendar.js";
import { EventCard } from "../../../../../components/calendar/event-card.js";
import { EventForm } from "../../../../../components/calendar/event-form.js";
import listingStyles from "../../../../../styles/listing-page.module.css";
import styles from "./project-detail.module.css";

// ── Private Types ──

export interface ManageProjectDetailLoaderData {
  readonly project: Project;
  readonly events: CalendarEventsResponse;
}

// ── Route ──

const manageRoute = getRouteApi("/creators/$creatorId/manage");
const thisRoute = getRouteApi("/creators/$creatorId/manage/projects/$projectSlug");

export const Route = createFileRoute("/creators/$creatorId/manage/projects/$projectSlug")({
  errorComponent: RouteErrorBoundary,
  loader: async ({ params }): Promise<ManageProjectDetailLoaderData> => {
    const [projectRes, events] = await Promise.all([
      fetchApiServer({
        data: `/api/projects/${encodeURIComponent(params.projectSlug)}`,
      }) as Promise<{ project: Project }>,
      fetchApiServer({
        data: `/api/projects/${encodeURIComponent(params.projectSlug)}/events`,
      }) as Promise<CalendarEventsResponse>,
    ]);

    return { project: projectRes.project, events };
  },
  component: ManageProjectDetailPage,
});

// ── Component ──

function ManageProjectDetailPage(): React.ReactElement {
  const { project: initialProject, events: initialEvents } = thisRoute.useLoaderData() as ManageProjectDetailLoaderData;
  const { creatorId } = thisRoute.useParams() as { creatorId: string; projectSlug: string };

  // Access manage route data (needed for context, available via parent)
  manageRoute.useLoaderData();

  const navigate = useNavigate();
  const router = useRouter();

  const [project, setProject] = useState<Project>(initialProject);
  const [events, setEvents] = useState<CalendarEvent[]>([...initialEvents.items]);
  const [error, setError] = useState<string | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);

  const handleToggleComplete = async (id: string) => {
    setError(null);
    try {
      const updated = await toggleEventComplete(id);
      setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update task");
    }
  };

  const handleToggleProjectComplete = async () => {
    setError(null);
    try {
      const updated = await updateProject(project.id, {
        completed: !project.completed,
      });
      setProject(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update project");
    }
  };

  const handleDeleteProject = async () => {
    setError(null);
    try {
      await deleteProject(project.id);
      void navigate({ to: "/creators/$creatorId/manage/projects", params: { creatorId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete project");
    }
  };

  const handleEventFormSuccess = () => {
    setShowEventForm(false);
    // Reload events via router invalidation — avoids full-page reload
    void router.invalidate();
  };

  return (
    <div className={styles.page}>
      <Link
        to="/creators/$creatorId/manage/projects"
        params={{ creatorId }}
        className={styles.backLink}
      >
        Back to Projects
      </Link>

      {/* ── Project Header ── */}
      <div className={styles.projectHeader}>
        <div className={styles.projectTitleRow}>
          <h1 className={listingStyles.heading}>{project.name}</h1>
          {project.completed && (
            <span className={styles.completedBadge}>Completed</span>
          )}
        </div>
        {project.description && (
          <p className={styles.projectDescription}>{project.description}</p>
        )}
        <div className={styles.projectActions}>
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => { void handleToggleProjectComplete(); }}
          >
            {project.completed ? "Reopen" : "Complete"}
          </button>
          <button
            type="button"
            className={styles.deleteButton}
            onClick={() => { void handleDeleteProject(); }}
          >
            Delete Project
          </button>
        </div>
      </div>

      {error !== null && (
        <div className={styles.error} role="alert">{error}</div>
      )}

      {/* ── Timeline Section ── */}
      <div className={styles.timelineSection}>
        <div className={styles.timelineHeader}>
          <h2 className={styles.timelineHeading}>Timeline</h2>
          <button
            type="button"
            className={styles.addEventButton}
            onClick={() => setShowEventForm(true)}
          >
            Add Event
          </button>
        </div>

        {showEventForm && (
          <div className={styles.formWrapper}>
            <EventForm
              defaultProjectId={project.id}
              onSuccess={handleEventFormSuccess}
              onCancel={() => setShowEventForm(false)}
            />
          </div>
        )}

        {events.length === 0 ? (
          <p className={listingStyles.status}>
            No upcoming events or tasks. Add one to get started.
          </p>
        ) : (
          <div className={styles.timelineList}>
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onToggleComplete={(id) => { void handleToggleComplete(id); }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
