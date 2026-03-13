import { useState } from "react";
import type React from "react";
import type { FormEvent } from "react";

import { z, minLength, maxLength, safeParse } from "zod/mini";
import {
  EVENT_CATEGORIES,
  MAX_EVENT_TITLE_LENGTH,
  MAX_EVENT_DESCRIPTION_LENGTH,
  MAX_EVENT_LOCATION_LENGTH,
} from "@snc/shared";
import type { CalendarEvent } from "@snc/shared";

import { createCalendarEvent, updateCalendarEvent } from "../../lib/calendar.js";
import { extractFieldErrors } from "../../lib/form-utils.js";
import formStyles from "../../styles/form.module.css";
import styles from "./event-form.module.css";

// ── Private Constants ──

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "recording-session", label: "Recording Session" },
  { value: "album-milestone", label: "Album Milestone" },
  { value: "show", label: "Show" },
  { value: "meeting", label: "Meeting" },
];

const EVENT_FORM_SCHEMA = z.object({
  title: z
    .string()
    .check(
      minLength(1, "Title is required"),
      maxLength(MAX_EVENT_TITLE_LENGTH, `Title cannot exceed ${MAX_EVENT_TITLE_LENGTH} characters`),
    ),
  description: z
    .string()
    .check(
      maxLength(MAX_EVENT_DESCRIPTION_LENGTH, `Description cannot exceed ${MAX_EVENT_DESCRIPTION_LENGTH} characters`),
    ),
  startAt: z.string().check(minLength(1, "Start date/time is required")),
  endAt: z.string(),
  category: z.string().check(minLength(1, "Category is required")),
  location: z
    .string()
    .check(
      maxLength(MAX_EVENT_LOCATION_LENGTH, `Location cannot exceed ${MAX_EVENT_LOCATION_LENGTH} characters`),
    ),
});

type EventFormFields = "title" | "description" | "startAt" | "endAt" | "category" | "location";
type FieldErrors = Partial<Record<EventFormFields, string>>;

// ── Public Types ──

export interface EventFormProps {
  readonly event?: CalendarEvent;
  readonly onSuccess: () => void;
  readonly onCancel: () => void;
}

// ── Public API ──

export function EventForm({
  event,
  onSuccess,
  onCancel,
}: EventFormProps): React.ReactElement {
  const isEdit = event !== undefined;

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [startAt, setStartAt] = useState(
    event ? event.startAt.slice(0, 16) : "",
  );
  const [endAt, setEndAt] = useState(
    event?.endAt ? event.endAt.slice(0, 16) : "",
  );
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [category, setCategory] = useState(event?.category ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const result = safeParse(EVENT_FORM_SCHEMA, {
      title,
      description,
      startAt,
      endAt,
      category,
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
        "startAt",
        "endAt",
        "category",
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
      const payload = {
        title: data.title,
        description: data.description,
        startAt: new Date(data.startAt).toISOString(),
        endAt: data.endAt ? new Date(data.endAt).toISOString() : null,
        allDay,
        category: data.category as (typeof EVENT_CATEGORIES)[number],
        location: data.location,
      };

      if (isEdit) {
        await updateCalendarEvent(event.id, payload);
      } else {
        await createCalendarEvent(payload);
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
          className={
            fieldErrors.title
              ? `${formStyles.input} ${formStyles.inputError}`
              : formStyles.input
          }
        />
        {fieldErrors.title && (
          <span className={formStyles.fieldError} role="alert">
            {fieldErrors.title}
          </span>
        )}
      </div>

      <div className={formStyles.fieldGroup}>
        <label htmlFor="event-category" className={formStyles.label}>
          Category
        </label>
        <select
          id="event-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={
            fieldErrors.category
              ? `${formStyles.input} ${formStyles.inputError}`
              : formStyles.input
          }
        >
          <option value="">Select category...</option>
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {fieldErrors.category && (
          <span className={formStyles.fieldError} role="alert">
            {fieldErrors.category}
          </span>
        )}
      </div>

      <div className={styles.dateRow}>
        <div className={formStyles.fieldGroup}>
          <label htmlFor="event-start" className={formStyles.label}>
            Start
          </label>
          <input
            id="event-start"
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className={
              fieldErrors.startAt
                ? `${formStyles.input} ${formStyles.inputError}`
                : formStyles.input
            }
          />
          {fieldErrors.startAt && (
            <span className={formStyles.fieldError} role="alert">
              {fieldErrors.startAt}
            </span>
          )}
        </div>

        <div className={formStyles.fieldGroup}>
          <label htmlFor="event-end" className={formStyles.label}>
            End
          </label>
          <input
            id="event-end"
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            className={formStyles.input}
          />
        </div>
      </div>

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
          disabled={isSubmitting}
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
      </div>
    </form>
  );
}
