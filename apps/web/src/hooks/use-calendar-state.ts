import type { CalendarEvent } from "@snc/shared";

import { useCalendarFilters } from "./use-calendar-filters.js";
import { useCalendarNavigation } from "./use-calendar-navigation.js";
import { useCalendarEvents } from "./use-calendar-events.js";
import { useCalendarForm } from "./use-calendar-form.js";

// ── Public Types ──

export interface UseCalendarStateOptions {
  /** Scopes all fetches to a specific creator. */
  readonly creatorId?: string;
  /** Show the creator filter dropdown (main calendar page). */
  readonly includeCreatorFilter?: boolean;
  /** SSR loader data for the main calendar page (skips initial client fetch). */
  readonly initialEvents?: readonly CalendarEvent[];
}

export type { EventTypeOption, CreatorOption, ProjectOption } from "./use-calendar-filters.js";

export interface UseCalendarStateReturn {
  // Event state
  readonly events: CalendarEvent[];
  readonly error: string | null;
  readonly isDeleting: boolean;

  // View mode
  readonly viewMode: import("../components/calendar/view-toggle.js").CalendarViewMode;
  readonly setViewMode: (mode: import("../components/calendar/view-toggle.js").CalendarViewMode) => void;

  // Filters
  readonly eventTypeFilter: string;
  readonly setEventTypeFilter: (value: string) => void;
  readonly creatorFilter: string;
  readonly handleCreatorChange: (value: string) => void;
  readonly projectFilter: string;
  readonly setProjectFilter: (value: string) => void;

  // Filter options
  readonly eventTypeOptions: readonly import("./use-calendar-filters.js").EventTypeOption[];
  readonly creatorOptions: readonly import("./use-calendar-filters.js").CreatorOption[];
  readonly projectOptions: readonly import("./use-calendar-filters.js").ProjectOption[];

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

/** Manage calendar page state: event fetching, month navigation, filters, form visibility, and CRUD actions. */
export function useCalendarState(options: UseCalendarStateOptions = {}): UseCalendarStateReturn {
  const { creatorId, includeCreatorFilter = false, initialEvents } = options;

  const navigation = useCalendarNavigation();

  const filters = useCalendarFilters({ creatorId, includeCreatorFilter });

  const eventsState = useCalendarEvents({
    creatorId,
    initialEvents,
    monthOffset: navigation.monthOffset,
    viewMode: navigation.viewMode,
    eventTypeFilter: filters.eventTypeFilter,
    creatorFilter: filters.creatorFilter,
    projectFilter: filters.projectFilter,
  });

  const form = useCalendarForm({
    events: eventsState.events,
    onSuccess: eventsState.triggerReload,
    onDeleted: (id) => {
      eventsState.setEvents((prev) => prev.filter((e) => e.id !== id));
    },
  });

  return {
    events: eventsState.events,
    error: eventsState.error,
    isDeleting: eventsState.isDeleting,
    viewMode: navigation.viewMode,
    setViewMode: navigation.setViewMode,
    eventTypeFilter: filters.eventTypeFilter,
    setEventTypeFilter: filters.setEventTypeFilter,
    creatorFilter: filters.creatorFilter,
    handleCreatorChange: filters.handleCreatorChange,
    projectFilter: filters.projectFilter,
    setProjectFilter: filters.setProjectFilter,
    eventTypeOptions: filters.eventTypeOptions,
    creatorOptions: filters.creatorOptions,
    projectOptions: filters.projectOptions,
    monthOffset: navigation.monthOffset,
    monthLabel: navigation.monthLabel,
    currentYear: navigation.currentYear,
    currentMonthIndex: navigation.currentMonthIndex,
    handlePrev: navigation.handlePrev,
    handleNext: navigation.handleNext,
    showForm: form.showForm,
    editingEvent: form.editingEvent,
    handleNewEvent: form.handleNewEvent,
    handleEdit: form.handleEdit,
    handleFormSuccess: form.handleFormSuccess,
    handleFormCancel: form.handleFormCancel,
    handleFormDeleted: form.handleFormDeleted,
    handleDelete: eventsState.handleDelete,
    handleToggleComplete: eventsState.handleToggleComplete,
  };
}
