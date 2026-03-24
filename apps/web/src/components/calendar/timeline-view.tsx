import { useRef } from "react";
import type React from "react";
import type { CalendarEvent } from "@snc/shared";

import { useCursorPagination } from "../../hooks/use-cursor-pagination.js";
import { EventList } from "./event-list.js";
import listingStyles from "../../styles/listing-page.module.css";
import styles from "./timeline-view.module.css";

// ── Public Types ──

export interface TimelineViewProps {
  readonly eventTypeFilter: string;
  readonly creatorFilter: string;
  readonly projectFilter: string;
  readonly creatorId?: string | undefined;
  readonly onEdit?: (id: string) => void;
  readonly onDelete?: (id: string) => void;
  readonly onToggleComplete?: (id: string) => void;
}

// ── Public API ──

/** Paginated chronological event list starting from today, with cursor-based load-more and support for event type, creator, and project filters. */
export function TimelineView({
  eventTypeFilter,
  creatorFilter,
  projectFilter,
  creatorId,
  onEdit,
  onDelete,
  onToggleComplete,
}: TimelineViewProps): React.ReactElement {
  const fromDateRef = useRef(new Date().toISOString());

  const { items, nextCursor, isLoading, error, loadMore } =
    useCursorPagination<CalendarEvent>({
      buildUrl: (cursor) => {
        const params = new URLSearchParams({ from: fromDateRef.current, limit: "50" });
        if (eventTypeFilter) params.set("eventType", eventTypeFilter);
        if (creatorFilter) params.set("creatorId", creatorFilter);
        if (projectFilter) params.set("projectId", projectFilter);
        if (cursor) params.set("cursor", cursor);

        if (creatorId) {
          return `/api/creators/${creatorId}/events?${params.toString()}`;
        }
        return `/api/calendar/events?${params.toString()}`;
      },
      deps: [eventTypeFilter, creatorFilter, projectFilter, creatorId],
      fetchOptions: { credentials: "include" },
    });

  return (
    <div className={styles.timeline}>
      {error && (
        <div className={listingStyles.status} role="alert">{error}</div>
      )}

      <EventList
        events={items}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleComplete={onToggleComplete}
      />

      {isLoading && <p className={listingStyles.status}>Loading...</p>}

      {nextCursor && !isLoading && (
        <div className={listingStyles.loadMoreWrapper}>
          <button
            type="button"
            className={listingStyles.loadMoreButton}
            onClick={loadMore}
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
