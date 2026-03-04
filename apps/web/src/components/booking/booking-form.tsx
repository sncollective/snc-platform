import { useState, useCallback } from "react";
import type React from "react";
import type { FormEvent } from "react";

import { z, minLength, maxLength, safeParse } from "zod/mini";

import { createBooking } from "../../lib/booking.js";
import { extractFieldErrors } from "../../lib/form-utils.js";
import styles from "./booking-form.module.css";

// ── Private Constants ──

const MAX_DATES = 5;

const BOOKING_FORM_SCHEMA = z.object({
  preferredDates: z
    .array(z.string().check(minLength(1, "Date cannot be empty")))
    .check(
      minLength(1, "At least one preferred date is required"),
      maxLength(MAX_DATES, `Maximum ${MAX_DATES} preferred dates allowed`),
    ),
  notes: z
    .string()
    .check(maxLength(2000, "Notes cannot exceed 2000 characters")),
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
  const updateDate = useCallback((index: number, value: string) => {
    setPreferredDates((prev) => prev.map((d, i) => (i === index ? value : d)));
  }, []);

  const addDate = useCallback(() => {
    setPreferredDates((prev) =>
      prev.length < MAX_DATES ? [...prev, ""] : prev,
    );
  }, []);

  const removeDate = useCallback((index: number) => {
    setPreferredDates((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : prev,
    );
  }, []);

  // Validation
  const validate = useCallback((): BookingFormFields | null => {
    const result = safeParse(BOOKING_FORM_SCHEMA, { preferredDates, notes });
    if (result.success) {
      setFieldErrors({});
      return result.data;
    }
    setFieldErrors(
      extractFieldErrors(result.error.issues, ["preferredDates", "notes"]),
    );
    return null;
  }, [preferredDates, notes]);

  // Submit handler
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
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
    },
    [validate, serviceId, onSubmit],
  );

  // Render
  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h4 className={styles.serviceName}>
        Book: {serviceName}
      </h4>

      {serverError && (
        <div className={styles.serverError} role="alert">
          {serverError}
        </div>
      )}

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Preferred Dates</label>
        {preferredDates.map((date, index) => (
          <div className={styles.dateRow} key={index}>
            <input
              type="text"
              value={date}
              onChange={(e) => updateDate(index, e.target.value)}
              placeholder={`e.g. March ${15 + index}, 2026`}
              className={
                fieldErrors.preferredDates
                  ? `${styles.input} ${styles.inputError}`
                  : styles.input
              }
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
          <span className={styles.fieldError} role="alert">
            {fieldErrors.preferredDates}
          </span>
        )}
        <button
          type="button"
          className={styles.addDateButton}
          onClick={addDate}
          disabled={preferredDates.length >= MAX_DATES}
        >
          Add another date
        </button>
      </div>

      <div className={styles.fieldGroup}>
        <label htmlFor="booking-notes" className={styles.label}>
          Notes
        </label>
        <textarea
          id="booking-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any details about your booking request..."
          className={
            fieldErrors.notes
              ? `${styles.textarea} ${styles.inputError}`
              : styles.textarea
          }
        />
        {fieldErrors.notes && (
          <span className={styles.fieldError} role="alert">
            {fieldErrors.notes}
          </span>
        )}
      </div>

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.submitButton}
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
