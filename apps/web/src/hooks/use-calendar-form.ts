import { useState, useCallback } from "react";

import type { CalendarEvent } from "@snc/shared";

// ── Public Types ──

export interface UseCalendarFormOptions {
  readonly events: readonly CalendarEvent[];
  readonly onSuccess: () => void;
  readonly onDeleted: (id: string) => void;
}

export interface UseCalendarFormReturn {
  readonly showForm: boolean;
  readonly editingEvent: CalendarEvent | undefined;
  readonly handleNewEvent: () => void;
  readonly handleEdit: (id: string) => void;
  readonly handleFormSuccess: () => void;
  readonly handleFormCancel: () => void;
  readonly handleFormDeleted: () => void;
}

// ── Public API ──

/** Manage calendar event form visibility and the event being edited. */
export function useCalendarForm(options: UseCalendarFormOptions): UseCalendarFormReturn {
  const { events, onSuccess, onDeleted } = options;

  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);

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
    onSuccess();
  }, [onSuccess]);

  const handleFormCancel = useCallback(() => {
    setShowForm(false);
    setEditingEvent(undefined);
  }, []);

  const handleFormDeleted = useCallback(() => {
    const editing = editingEvent;
    if (editing) {
      onDeleted(editing.id);
    }
    setShowForm(false);
    setEditingEvent(undefined);
  }, [editingEvent, onDeleted]);

  return {
    showForm,
    editingEvent,
    handleNewEvent,
    handleEdit,
    handleFormSuccess,
    handleFormCancel,
    handleFormDeleted,
  };
}
