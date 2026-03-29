import { useState, useEffect, useRef, useCallback } from "react";
import type React from "react";

import type { CalendarEvent } from "@snc/shared";

import {
  fetchCalendarEvents,
  fetchCreatorEvents,
  deleteCalendarEvent,
  deleteCreatorEvent,
  toggleEventComplete,
} from "../lib/calendar.js";
import type { CalendarViewMode } from "../components/calendar/view-toggle.js";

// ── Public Types ──

export interface UseCalendarEventsOptions {
  readonly creatorId?: string;
  readonly initialEvents?: readonly CalendarEvent[];
  readonly monthOffset: number;
  readonly viewMode: CalendarViewMode;
  readonly eventTypeFilter: string;
  readonly creatorFilter: string;
  readonly projectFilter: string;
}

export interface UseCalendarEventsReturn {
  readonly events: CalendarEvent[];
  readonly error: string | null;
  readonly isDeleting: boolean;
  readonly handleDelete: (id: string) => Promise<void>;
  readonly handleToggleComplete: (id: string) => Promise<void>;
  readonly reloadKey: number;
  readonly setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  readonly setError: React.Dispatch<React.SetStateAction<string | null>>;
  readonly triggerReload: () => void;
}

// ── Public API ──

/** Fetch, delete, and toggle calendar events, reacting to filter and navigation changes. */
export function useCalendarEvents(options: UseCalendarEventsOptions): UseCalendarEventsReturn {
  const {
    creatorId,
    initialEvents,
    monthOffset,
    viewMode,
    eventTypeFilter,
    creatorFilter,
    projectFilter,
  } = options;

  const [events, setEvents] = useState<CalendarEvent[]>(
    initialEvents ? [...initialEvents] : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const hasLoaderData = useRef(initialEvents !== undefined);

  // ── Fetch events ──
  useEffect(() => {
    if (viewMode === "timeline") return;

    // Skip the initial client-side fetch — SSR loader already provided current month data
    if (hasLoaderData.current && monthOffset === 0 && !eventTypeFilter && !creatorFilter && !projectFilter) {
      hasLoaderData.current = false;
      return;
    }
    hasLoaderData.current = false;

    // Derive date range from monthOffset
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

    const load = async () => {
      try {
        const result = creatorId
          ? await fetchCreatorEvents(creatorId, params)
          : await fetchCalendarEvents(params);
        if (!cancelled) setEvents(result.items);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load events");
      }
    };
    void load();

    return () => { cancelled = true; };
  }, [monthOffset, eventTypeFilter, creatorFilter, projectFilter, viewMode, reloadKey, creatorId]);

  const triggerReload = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  // ── CRUD handlers ──
  const handleDelete = useCallback(async (id: string) => {
    setIsDeleting(true);
    setError(null);
    try {
      if (creatorId) {
        await deleteCreatorEvent(creatorId, id);
      } else {
        await deleteCalendarEvent(id);
      }
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete event");
    } finally {
      setIsDeleting(false);
    }
  }, [creatorId]);

  const handleToggleComplete = useCallback(async (id: string) => {
    setError(null);
    try {
      const updated = await toggleEventComplete(id);
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? updated : e)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update task");
    }
  }, []);

  return {
    events,
    error,
    isDeleting,
    handleDelete,
    handleToggleComplete,
    reloadKey,
    setEvents,
    setError,
    triggerReload,
  };
}
