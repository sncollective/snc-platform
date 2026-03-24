import { useState, useEffect, useRef, useCallback } from "react";
import type { CalendarEvent } from "@snc/shared";
import { DEFAULT_EVENT_TYPE_LABELS } from "@snc/shared";

import {
  fetchCalendarEvents,
  fetchCreatorEvents,
  deleteCalendarEvent,
  deleteCreatorEvent,
  fetchEventTypes,
  toggleEventComplete,
} from "../lib/calendar.js";
import { fetchProjects } from "../lib/project.js";
import { apiGet } from "../lib/fetch-utils.js";
import type { CalendarViewMode } from "../components/calendar/view-toggle.js";

// ── Public Types ──

export interface UseCalendarStateOptions {
  /** Scopes all fetches to a specific creator. */
  readonly creatorId?: string;
  /** Show the creator filter dropdown (main calendar page). */
  readonly includeCreatorFilter?: boolean;
  /** SSR loader data for the main calendar page (skips initial client fetch). */
  readonly initialEvents?: readonly CalendarEvent[];
}

export interface EventTypeOption {
  readonly value: string;
  readonly label: string;
}

export interface CreatorOption {
  readonly id: string;
  readonly name: string;
}

export interface ProjectOption {
  readonly id: string;
  readonly name: string;
}

export interface UseCalendarStateReturn {
  // Event state
  readonly events: CalendarEvent[];
  readonly error: string | null;
  readonly isDeleting: boolean;

  // View mode
  readonly viewMode: CalendarViewMode;
  readonly setViewMode: (mode: CalendarViewMode) => void;

  // Filters
  readonly eventTypeFilter: string;
  readonly setEventTypeFilter: (value: string) => void;
  readonly creatorFilter: string;
  readonly handleCreatorChange: (value: string) => void;
  readonly projectFilter: string;
  readonly setProjectFilter: (value: string) => void;

  // Filter options
  readonly eventTypeOptions: readonly EventTypeOption[];
  readonly creatorOptions: readonly CreatorOption[];
  readonly projectOptions: readonly ProjectOption[];

  // Month navigation
  readonly monthOffset: number;
  readonly monthLabel: string;
  readonly currentYear: number;
  readonly currentMonthIndex: number;
  readonly handlePrev: () => void;
  readonly handleNext: () => void;

  // Form state
  readonly showForm: boolean;
  readonly editingEvent: CalendarEvent | undefined;
  readonly handleNewEvent: () => void;
  readonly handleEdit: (id: string) => void;
  readonly handleFormSuccess: () => void;
  readonly handleFormCancel: () => void;
  readonly handleFormDeleted: () => void;

  // CRUD actions
  readonly handleDelete: (id: string) => Promise<void>;
  readonly handleToggleComplete: (id: string) => Promise<void>;
}

// ── Public API ──

export function useCalendarState(options: UseCalendarStateOptions = {}): UseCalendarStateReturn {
  const { creatorId, includeCreatorFilter = false, initialEvents } = options;

  // ── Event state ──
  const [events, setEvents] = useState<CalendarEvent[]>(
    initialEvents ? [...initialEvents] : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── View mode ──
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");

  // ── Filters ──
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");
  const [creatorFilter, setCreatorFilter] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("");

  // ── Filter options ──
  const [eventTypeOptions, setEventTypeOptions] = useState<EventTypeOption[]>([]);
  const [creatorOptions, setCreatorOptions] = useState<CreatorOption[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);

  // ── Form state ──
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);
  const [reloadKey, setReloadKey] = useState(0);

  // ── Month navigation ──
  const [monthOffset, setMonthOffset] = useState(0);

  const displayDate = new Date();
  displayDate.setMonth(displayDate.getMonth() + monthOffset);
  const monthLabel = displayDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const currentYear = displayDate.getFullYear();
  const currentMonthIndex = displayDate.getMonth();

  // ── SSR loader data tracking ──
  const hasLoaderData = useRef(initialEvents !== undefined);

  // ── Fetch event types (once) ──
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchEventTypes();
        setEventTypeOptions(
          res.items.map((et) => ({ value: et.slug, label: et.label })),
        );
      } catch {
        // Fallback to default labels
        setEventTypeOptions(
          Object.entries(DEFAULT_EVENT_TYPE_LABELS).map(([slug, label]) => ({
            value: slug,
            label,
          })),
        );
      }
    };
    void load();
  }, []);

  // ── Fetch creator options (main page only, once) ──
  useEffect(() => {
    if (!includeCreatorFilter) return;

    const load = async () => {
      try {
        const res = await apiGet<{ items: { id: string; displayName: string }[] }>("/api/creators");
        setCreatorOptions(res.items.map((c) => ({ id: c.id, name: c.displayName })));
      } catch (e) {
        console.warn("Failed to load creator filter options", e instanceof Error ? e.message : String(e));
      }
    };
    void load();
  }, [includeCreatorFilter]);

  // ── Fetch project options (re-fetches when creator filter or creatorId changes) ──
  useEffect(() => {
    const effectiveCreator = creatorId ?? creatorFilter;
    const params: Record<string, string> = { completed: "false" };
    if (effectiveCreator) params.creatorId = effectiveCreator;

    const load = async () => {
      try {
        const res = await fetchProjects(params);
        setProjectOptions(res.items.map((p) => ({ id: p.id, name: p.name })));
      } catch (e) {
        console.warn("Failed to load project filter options", e instanceof Error ? e.message : String(e));
      }
    };
    void load();
  }, [creatorId, creatorFilter]);

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

  // ── Navigation handlers ──
  const handlePrev = useCallback(() => {
    setMonthOffset((o) => o - 1);
  }, []);

  const handleNext = useCallback(() => {
    setMonthOffset((o) => o + 1);
  }, []);

  // ── Creator filter handler (resets project filter) ──
  const handleCreatorChange = useCallback((value: string) => {
    setCreatorFilter(value);
    setProjectFilter("");
  }, []);

  // ── Form handlers ──
  const handleNewEvent = useCallback(() => {
    setEditingEvent(undefined);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((id: string) => {
    const event = events.find((e) => e.id === id);
    if (event) {
      setEditingEvent(event);
      setShowForm(true);
    }
  }, [events]);

  const handleFormSuccess = useCallback(() => {
    setShowForm(false);
    setEditingEvent(undefined);
    setReloadKey((k) => k + 1);
  }, []);

  const handleFormCancel = useCallback(() => {
    setShowForm(false);
    setEditingEvent(undefined);
  }, []);

  const handleFormDeleted = useCallback(() => {
    setEvents((prev) => {
      const editing = editingEvent;
      if (!editing) return prev;
      return prev.filter((e) => e.id !== editing.id);
    });
    setShowForm(false);
    setEditingEvent(undefined);
  }, [editingEvent]);

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
    viewMode,
    setViewMode,
    eventTypeFilter,
    setEventTypeFilter,
    creatorFilter,
    handleCreatorChange,
    projectFilter,
    setProjectFilter,
    eventTypeOptions,
    creatorOptions,
    projectOptions,
    monthOffset,
    monthLabel,
    currentYear,
    currentMonthIndex,
    handlePrev,
    handleNext,
    showForm,
    editingEvent,
    handleNewEvent,
    handleEdit,
    handleFormSuccess,
    handleFormCancel,
    handleFormDeleted,
    handleDelete,
    handleToggleComplete,
  };
}
