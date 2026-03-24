import { useState } from "react";
import type React from "react";
import type { FormEvent } from "react";

import { z, minLength, maxLength, safeParse } from "zod/mini";
import { MAX_PREFERRED_DATES, MAX_BOOKING_NOTES_LENGTH } from "@snc/shared";

import { createBooking } from "../../lib/booking.js";
import { extractFieldErrors } from "../../lib/form-utils.js";
import { clsx } from "clsx/lite";

import formStyles from "../../styles/form.module.css";
import styles from "./booking-form.module.css";

// ── Private Constants ──

const BOOKING_FORM_SCHEMA = z.object({
  preferredDates: z
    .array(z.string().check(minLength(1, "Date cannot be empty")))
    .check(
      minLength(1, "At least one preferred date is required"),
      maxLength(MAX_PREFERRED_DATES, `Maximum ${MAX_PREFERRED_DATES} preferred dates allowed`),
    ),
  notes: z
    .string()
    .check(maxLength(MAX_BOOKING_NOTES_LENGTH, `Notes cannot exceed ${MAX_BOOKING_NOTES_LENGTH} characters`)),
});

type BookingFormFields = z.infer<typeof BOOKING_FORM_SCHEMA>;

type FieldErrors = Partial<Record<"preferredDates" | "notes", string>>;

// ── Public Types ──

export interface BookingFormProps {
  readonly serviceId: string;
  readonly serviceName: string;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
}

// ── Public API ──

/** Booking request form that collects preferred dates and notes for a given service, validates with Zod, and submits via the booking API. */
export function BookingForm({
  serviceId,
  serviceName,
  onSubmit,
  onCancel,
}: BookingFormProps): React.ReactElement {
  // State
  const [preferredDates, setPreferredDates] = useState<string[]>([""]);
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Date management callbacks
  const updateDate = (index: number, value: string) => {
    setPreferredDates((prev) => prev.map((d, i) => (i === index ? value : d)));
  };

  const addDate = () => {
    setPreferredDates((prev) =>
      prev.length < MAX_PREFERRED_DATES ? [...prev, ""] : prev,
    );
  };

  const removeDate = (index: number) => {
    setPreferredDates((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : prev,
    );
  };

  // Validation
  const validate = (): BookingFormFields | null => {
    const result = safeParse(BOOKING_FORM_SCHEMA, { preferredDates, notes });
    if (result.success) {
      setFieldErrors({});
      return result.data;
    }
    setFieldErrors(
      extractFieldErrors(result.error.issues, ["preferredDates", "notes"]),
    );
    return null;
  };

  // Submit handler
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError("");

    const data = validate();
    if (!data) return;

    setIsSubmitting(true);

    try {
      await createBooking({
        serviceId,
        preferredDates: data.preferredDates,
        notes: data.notes,
      });
      onSubmit();
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Failed to submit booking request",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render
  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h3 className={styles.serviceName}>
        Book: {serviceName}
      </h3>

      {serverError && (
        <div className={formStyles.serverError} role="alert">
          {serverError}
        </div>
      )}

      <fieldset className={clsx(formStyles.fieldGroup, styles.datesFieldset)}>
        <legend className={formStyles.label}>Preferred Dates</legend>
        {preferredDates.map((date, index) => (
          <div className={styles.dateRow} key={index}>
            <input
              type="text"
              value={date}
              onChange={(e) => updateDate(index, e.target.value)}
              placeholder={`e.g. March ${15 + index}, 2026`}
              className={clsx(formStyles.input, styles.dateRowInput, fieldErrors.preferredDates && formStyles.inputError)}
              aria-label={`Preferred date ${index + 1}`}
            />
            <button
              type="button"
              className={styles.removeButton}
              onClick={() => removeDate(index)}
              disabled={preferredDates.length <= 1}
              aria-label={`Remove date ${index + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
        {fieldErrors.preferredDates && (
          <span className={formStyles.fieldError} role="alert">
            {fieldErrors.preferredDates}
          </span>
        )}
        <button
          type="button"
          className={styles.addDateButton}
          onClick={addDate}
          disabled={preferredDates.length >= MAX_PREFERRED_DATES}
        >
          Add another date
        </button>
      </fieldset>

      <div className={formStyles.fieldGroup}>
        <label htmlFor="booking-notes" className={formStyles.label}>
          Notes
        </label>
        <textarea
          id="booking-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any details about your booking request..."
          className={clsx(formStyles.textarea, styles.textarea, fieldErrors.notes && formStyles.inputError)}
        />
        {fieldErrors.notes && (
          <span className={formStyles.fieldError} role="alert">
            {fieldErrors.notes}
          </span>
        )}
      </div>

      <div className={styles.actions}>
        <button
          type="submit"
          className={clsx(formStyles.submitButton, styles.submitButton)}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting\u2026" : "Submit Request"}
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
