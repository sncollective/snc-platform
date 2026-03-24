import { useState, useEffect } from "react";
import type React from "react";
import type { FormEvent } from "react";

import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { z, minLength, maxLength, safeParse } from "zod/mini";
import {
  DEFAULT_EVENT_TYPE_LABELS,
  MAX_EVENT_TITLE_LENGTH,
  MAX_EVENT_DESCRIPTION_LENGTH,
  MAX_EVENT_LOCATION_LENGTH,
} from "@snc/shared";
import type { CalendarEvent } from "@snc/shared";

import {
  createCalendarEvent,
  updateCalendarEvent,
  createCreatorEvent,
  updateCreatorEvent,
  deleteCalendarEvent,
  deleteCreatorEvent,
  fetchEventTypes,
  createCustomEventType,
} from "../../lib/calendar.js";
import { getUserTimezone } from "../../lib/format.js";
import { fetchProjects } from "../../lib/project.js";
import { extractFieldErrors } from "../../lib/form-utils.js";
import { DatePickerInput } from "./date-picker-input.js";
import { TimePickerSelect } from "./time-picker-select.js";
import { clsx } from "clsx/lite";

import formStyles from "../../styles/form.module.css";
import styles from "./event-form.module.css";

// ── Private Constants ──

const EVENT_FORM_SCHEMA = z.object({
  title: z.string().check(
    minLength(1, "Title is required"),
    maxLength(MAX_EVENT_TITLE_LENGTH, `Title cannot exceed ${MAX_EVENT_TITLE_LENGTH} characters`),
  ),
  description: z.string().check(
    maxLength(MAX_EVENT_DESCRIPTION_LENGTH, `Description cannot exceed ${MAX_EVENT_DESCRIPTION_LENGTH} characters`),
  ),
  startDateTime: z.string().check(minLength(1, "Start date/time is required")),
  endDateTime: z.string(),
  eventType: z.string().check(minLength(1, "Event type is required")),
  location: z.string().check(
    maxLength(MAX_EVENT_LOCATION_LENGTH, `Location cannot exceed ${MAX_EVENT_LOCATION_LENGTH} characters`),
  ),
});

type EventFormFields = "title" | "description" | "startDateTime" | "endDateTime" | "eventType" | "location";
type FieldErrors = Partial<Record<EventFormFields, string>>;

// ── Private Helpers ──

/** Convert a display label to a slug (e.g. "Single Release" → "single-release"). */
const toSlug = (label: string): string =>
  label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

/** Convert a datetime-local value (YYYY-MM-DDTHH:MM) or date (YYYY-MM-DD) to ISO string. */
const toISOFromLocal = (value: string): string => {
  if (!value) return "";
  if (value.includes("T")) {
    return new Date(value).toISOString();
  }
  return new Date(`${value}T00:00:00`).toISOString();
};

const extractLocalParts = (isoString: string): { date: string; time: string } => {
  const tz = getUserTimezone();
  const date = parseISO(isoString);
  return {
    date: formatInTimeZone(date, tz, "yyyy-MM-dd"),
    time: formatInTimeZone(date, tz, "HH:mm"),
  };
};

// ── Public Types ──

export interface EventFormProps {
  readonly event?: CalendarEvent | undefined;
  readonly creatorId?: string | undefined;
  readonly defaultProjectId?: string | undefined;
  readonly defaultEventType?: string | undefined;
  readonly creatorOptions?: readonly { readonly id: string; readonly name: string }[] | undefined;
  readonly onSuccess: () => void;
  readonly onCancel: () => void;
  readonly onDeleted?: (() => void) | undefined;
}

// ── Public API ──

export function EventForm({
  event,
  creatorId: defaultCreatorId,
  defaultProjectId,
  defaultEventType,
  creatorOptions,
  onSuccess,
  onCancel,
  onDeleted,
}: EventFormProps): React.ReactElement {
  const isEdit = event !== undefined;

  const [selectedCreatorId, setSelectedCreatorId] = useState<string>(
    event?.creatorId ?? defaultCreatorId ?? "",
  );
  const effectiveCreatorId = selectedCreatorId || undefined;

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const startParts = event ? extractLocalParts(event.startAt) : null;
  const endParts = event?.endAt ? extractLocalParts(event.endAt) : null;

  const [startDate, setStartDate] = useState(() => {
    if (!event) return "";
    return startParts?.date ?? "";
  });
  const [startTime, setStartTime] = useState(() => {
    if (!event || event.allDay) return "";
    return startParts?.time ?? "";
  });
  const [endDate, setEndDate] = useState(() => {
    if (!event?.endAt) return "";
    return endParts?.date ?? "";
  });
  const [endTime, setEndTime] = useState(() => {
    if (!event?.endAt || event.allDay) return "";
    return endParts?.time ?? "";
  });

  const [showEnd, setShowEnd] = useState(() => {
    // Show end fields if editing an event that has an end date
    return !!event?.endAt;
  });

  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [eventType, setEventType] = useState(event?.eventType ?? defaultEventType ?? "");
  const [customEventTypeLabel, setCustomEventTypeLabel] = useState("");
  const [location, setLocation] = useState(event?.location ?? "");
  const [projectId, setProjectId] = useState<string>(event?.projectId ?? defaultProjectId ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── Event types (fetched from API) ──
  const [knownEventTypes, setKnownEventTypes] = useState<{ slug: string; label: string }[]>([]);
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  // ── Projects ──
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const loadEventTypes = async () => {
      try {
        const res = await fetchEventTypes();
        setKnownEventTypes(
          res.items.map((et) => ({ slug: et.slug, label: et.label })),
        );
      } catch {
        // Fallback: use default labels
        setKnownEventTypes(
          Object.entries(DEFAULT_EVENT_TYPE_LABELS).map(([slug, label]) => ({ slug, label })),
        );
      }
    };
    void loadEventTypes();
  }, []);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projectParams: Record<string, string> = { completed: "false" };
        if (selectedCreatorId) projectParams.creatorId = selectedCreatorId;
        const res = await fetchProjects(projectParams);
        setProjects(res.items.map((p) => ({ id: p.id, name: p.name })));
      } catch {
        // Projects are optional — silently ignore
      }
    };
    void loadProjects();
  }, [selectedCreatorId]);

  // Once known types load, reconcile: if editing an event whose type is now
  // a known type (custom default), select it directly instead of showing "Other"
  const eventTypeToReconcile = event?.eventType;
  useEffect(() => {
    if (!eventTypeToReconcile || knownEventTypes.length === 0) return;
    const match = knownEventTypes.find((et) => et.slug === eventTypeToReconcile);
    if (match) {
      setEventType(match.slug);
      setCustomEventTypeLabel("");
    } else {
      setEventType("other");
      setCustomEventTypeLabel(
        eventTypeToReconcile.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      );
    }
  }, [eventTypeToReconcile, knownEventTypes]);

  const isOtherSelected = eventType === "other";
  const customSlug = toSlug(customEventTypeLabel);
  const resolvedEventType = isOtherSelected ? customSlug : eventType;
  const isCustomType = isOtherSelected && customEventTypeLabel !== ""
    && !knownEventTypes.some((et) => et.slug === customSlug);

  // Compute combined datetime values for validation and submission
  const startDateTime = allDay
    ? startDate
    : startDate && startTime
      ? `${startDate}T${startTime}`
      : startDate;

  const endDateTime = allDay
    ? endDate
    : endDate && endTime
      ? `${endDate}T${endTime}`
      : endDate;

  const validate = () => {
    const result = safeParse(EVENT_FORM_SCHEMA, {
      title,
      description,
      startDateTime,
      endDateTime,
      eventType: resolvedEventType,
      location,
    });
    if (result.success) {
      setFieldErrors({});
      return result.data;
    }
    setFieldErrors(
      extractFieldErrors(result.error.issues, [
        "title",
        "description",
        "startDateTime",
        "endDateTime",
        "eventType",
        "location",
      ]),
    );
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError("");

    const data = validate();
    if (!data) return;

    setIsSubmitting(true);

    try {
      // Save custom event type if requested
      if (saveAsDefault && isCustomType) {
        await createCustomEventType(customEventTypeLabel);
      }

      const startIso = allDay
        ? toISOFromLocal(data.startDateTime.slice(0, 10))
        : toISOFromLocal(data.startDateTime);
      const endIso = data.endDateTime
        ? allDay
          ? toISOFromLocal(data.endDateTime.slice(0, 10))
          : toISOFromLocal(data.endDateTime)
        : null;

      const payload = {
        title: data.title,
        description: data.description,
        startAt: startIso,
        endAt: endIso,
        allDay,
        eventType: data.eventType,
        location: data.location,
        projectId: projectId || null,
      };

      if (isEdit) {
        if (effectiveCreatorId) {
          await updateCreatorEvent(effectiveCreatorId, event.id, payload);
        } else {
          await updateCalendarEvent(event.id, payload);
        }
      } else {
        if (effectiveCreatorId) {
          await createCreatorEvent(effectiveCreatorId, payload);
        } else {
          await createCalendarEvent(payload);
        }
      }
      onSuccess();
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Failed to save event",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    setIsDeleting(true);
    setServerError("");
    try {
      if (effectiveCreatorId) {
        await deleteCreatorEvent(effectiveCreatorId, event.id);
      } else {
        await deleteCalendarEvent(event.id);
      }
      onDeleted?.();
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Failed to delete event",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h4 className={styles.formHeading}>
        {isEdit ? "Edit Event" : "New Event"}
      </h4>

      {serverError && (
        <div className={formStyles.serverError} role="alert">
          {serverError}
        </div>
      )}

      <div className={formStyles.fieldGroup}>
        <label htmlFor="event-title" className={formStyles.label}>
          Title
        </label>
        <input
          id="event-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title"
          className={clsx(formStyles.input, fieldErrors.title && formStyles.inputError)}
        />
        {fieldErrors.title && (
          <span className={formStyles.fieldError} role="alert">
            {fieldErrors.title}
          </span>
        )}
      </div>

      <div className={formStyles.fieldGroup}>
        <label htmlFor="event-event-type" className={formStyles.label}>
          Event Type
        </label>
        <select
          id="event-event-type"
          value={eventType}
          onChange={(e) => {
            setEventType(e.target.value);
            if (e.target.value !== "other") {
              setCustomEventTypeLabel("");
              setSaveAsDefault(false);
            }
          }}
          className={clsx(formStyles.input, fieldErrors.eventType && formStyles.inputError)}
        >
          <option value="">Select event type...</option>
          {knownEventTypes.map((et) => (
            <option key={et.slug} value={et.slug}>
              {et.label}
            </option>
          ))}
        </select>
        {isOtherSelected && (
          <input
            id="event-custom-type"
            type="text"
            aria-label="Custom event type"
            value={customEventTypeLabel}
            onChange={(e) => {
              setCustomEventTypeLabel(e.target.value);
              setSaveAsDefault(false);
            }}
            placeholder="e.g. Single Release, Rehearsal..."
            className={formStyles.input}
            style={{ marginTop: "0.5rem" }}
          />
        )}
        {fieldErrors.eventType && (
          <span className={formStyles.fieldError} role="alert">
            {fieldErrors.eventType}
          </span>
        )}
        {isCustomType && (
          <div className={styles.checkboxRow}>
            <input
              id="event-save-as-default"
              type="checkbox"
              checked={saveAsDefault}
              onChange={(e) => setSaveAsDefault(e.target.checked)}
            />
            <label htmlFor="event-save-as-default" className={formStyles.label}>
              Save as default type
            </label>
          </div>
        )}
      </div>

      {projects.length > 0 && (
        <div className={formStyles.fieldGroup}>
          <label htmlFor="event-project" className={formStyles.label}>
            Project
          </label>
          <select
            id="event-project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className={formStyles.select}
          >
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {creatorOptions && creatorOptions.length > 0 && !isEdit && (
        <div className={formStyles.fieldGroup}>
          <label htmlFor="event-creator" className={formStyles.label}>
            Creator (optional)
          </label>
          <select
            id="event-creator"
            value={selectedCreatorId}
            onChange={(e) => setSelectedCreatorId(e.target.value)}
            className={formStyles.select}
          >
            <option value="">None (platform event)</option>
            {creatorOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.checkboxRow}>
        <input
          id="event-allday"
          type="checkbox"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
        />
        <label htmlFor="event-allday" className={formStyles.label}>
          All day
        </label>
      </div>

      {(() => {
        const dateRowClass = allDay
          ? styles.dateRow
          : showEnd
            ? styles.dateRowWithTime
            : styles.dateRowStartOnly;
        return (
          <div className={dateRowClass}>
            <div className={formStyles.fieldGroup}>
              <label htmlFor="event-start-date" className={formStyles.label}>
                Start date
              </label>
              <DatePickerInput
                id="event-start-date"
                value={startDate}
                onChange={setStartDate}
                hasError={!!fieldErrors.startDateTime}
              />
              {fieldErrors.startDateTime && (
                <span className={formStyles.fieldError} role="alert">
                  {fieldErrors.startDateTime}
                </span>
              )}
            </div>

            {!allDay && (
              <div className={formStyles.fieldGroup}>
                <label htmlFor="event-start-time" className={formStyles.label}>
                  Start time
                </label>
                <TimePickerSelect
                  id="event-start-time"
                  value={startTime}
                  onChange={setStartTime}
                />
              </div>
            )}

            {showEnd ? (
              <>
                <div className={formStyles.fieldGroup}>
                  <label htmlFor="event-end-date" className={formStyles.label}>
                    End date
                  </label>
                  <DatePickerInput
                    id="event-end-date"
                    value={endDate}
                    onChange={setEndDate}
                  />
                </div>

                {!allDay && (
                  <div className={formStyles.fieldGroup}>
                    <label htmlFor="event-end-time" className={formStyles.label}>
                      End time
                    </label>
                    <TimePickerSelect
                      id="event-end-time"
                      value={endTime}
                      onChange={setEndTime}
                    />
                  </div>
                )}

                <div className={formStyles.fieldGroup}>
                  <button
                    type="button"
                    className={styles.removeEndButton}
                    onClick={() => {
                      setShowEnd(false);
                      setEndDate("");
                      setEndTime("");
                    }}
                  >
                    Remove end
                  </button>
                </div>
              </>
            ) : (
              <div className={formStyles.fieldGroup}>
                <button
                  type="button"
                  className={styles.addEndButton}
                  onClick={() => setShowEnd(true)}
                >
                  + Add end date
                </button>
              </div>
            )}
          </div>
        );
      })()}

      <div className={formStyles.fieldGroup}>
        <label htmlFor="event-location" className={formStyles.label}>
          Location
        </label>
        <input
          id="event-location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Optional location"
          className={formStyles.input}
        />
      </div>

      <div className={formStyles.fieldGroup}>
        <label htmlFor="event-description" className={formStyles.label}>
          Description
        </label>
        <textarea
          id="event-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description..."
          className={formStyles.textarea}
        />
      </div>

      <div className={styles.actions}>
        <button
          type="submit"
          className={formStyles.submitButton}
          disabled={isSubmitting || isDeleting}
        >
          {isSubmitting
            ? "Saving\u2026"
            : isEdit
              ? "Save Changes"
              : "Create Event"}
        </button>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
        >
          Cancel
        </button>
        {isEdit && onDeleted && (
          <div className={styles.deleteGroup}>
            {confirmDelete ? (
              <>
                <span className={styles.deleteConfirmLabel}>Delete this event?</span>
                <button
                  type="button"
                  className={styles.deleteConfirmButton}
                  disabled={isDeleting}
                  onClick={() => { void handleDelete(); }}
                >
                  {isDeleting ? "Deleting\u2026" : "Yes, delete"}
                </button>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setConfirmDelete(false)}
                >
                  No
                </button>
              </>
            ) : (
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
