import { useState } from "react";
import type React from "react";

import { z, minLength, maxLength, email, safeParse } from "zod/mini";

import { STUDIO_SERVICES, STUDIO_SERVICE_LABELS } from "@snc/shared";
import type { StudioService } from "@snc/shared";

import { apiMutate } from "../../lib/fetch-utils.js";
import { extractFieldErrors } from "../../lib/form-utils.js";
import { clsx } from "clsx/lite";

import formStyles from "../../styles/form.module.css";
import styles from "./studio-inquiry-form.module.css";

// ── Private Constants ──

const INQUIRY_FORM_SCHEMA = z.object({
  name: z.string().check(
    minLength(1, "Name is required"),
    maxLength(100, "Name must be 100 characters or less"),
  ),
  email: email("Please enter a valid email address").check(
    maxLength(254, "Email must be 254 characters or less"),
  ),
  service: z.enum(STUDIO_SERVICES),
  message: z.string().check(
    minLength(10, "Message must be at least 10 characters"),
    maxLength(2000, "Message must be 2000 characters or less"),
  ),
});

// ── Public API ──

export function StudioInquiryForm(): React.ReactElement {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [service, setService] = useState<StudioService>("recording");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"name" | "email" | "service" | "message", string>>
  >({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const validate = () => {
    const result = safeParse(INQUIRY_FORM_SCHEMA, { name, email, service, message });
    if (result.success) {
      setFieldErrors({});
      return result.data;
    }
    setFieldErrors(
      extractFieldErrors(result.error.issues, ["name", "email", "service", "message"]),
    );
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    const data = validate();
    if (!data) return;
    setIsSubmitting(true);
    try {
      await apiMutate("/api/studio/inquiry", {
        method: "POST",
        body: { name: data.name, email: data.email, service: data.service, message: data.message },
      });
      setIsSubmitted(true);
    } catch {
      setServerError(
        "Something went wrong. Please try again or email us directly.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <section className={styles.section}>
        <div className={styles.success} role="status">
          <h2 className={styles.successHeading}>Inquiry Sent</h2>
          <p className={styles.successMessage}>
            Thanks for getting in touch. We'll get back to you soon.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Get in Touch</h2>
      <p className={styles.subheading}>
        Interested in booking the studio? Send us an inquiry and we'll get back
        to you.
      </p>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={formStyles.fieldGroup}>
          <label htmlFor="inquiry-name" className={formStyles.label}>
            Name
          </label>
          <input
            id="inquiry-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={clsx(formStyles.input, fieldErrors.name && formStyles.inputError)}
          />
          {fieldErrors.name && (
            <span className={formStyles.fieldError} role="alert">
              {fieldErrors.name}
            </span>
          )}
        </div>

        <div className={formStyles.fieldGroup}>
          <label htmlFor="inquiry-email" className={formStyles.label}>
            Email
          </label>
          <input
            id="inquiry-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={clsx(formStyles.input, fieldErrors.email && formStyles.inputError)}
          />
          {fieldErrors.email && (
            <span className={formStyles.fieldError} role="alert">
              {fieldErrors.email}
            </span>
          )}
        </div>

        <div className={formStyles.fieldGroup}>
          <label htmlFor="inquiry-service" className={formStyles.label}>
            Service
          </label>
          <select
            id="inquiry-service"
            value={service}
            onChange={(e) => setService(e.target.value as StudioService)}
            className={clsx(formStyles.select, fieldErrors.service && formStyles.inputError)}
          >
            {STUDIO_SERVICES.map((svc) => (
              <option key={svc} value={svc}>
                {STUDIO_SERVICE_LABELS[svc]}
              </option>
            ))}
          </select>
          {fieldErrors.service && (
            <span className={formStyles.fieldError} role="alert">
              {fieldErrors.service}
            </span>
          )}
        </div>

        <div className={formStyles.fieldGroup}>
          <label htmlFor="inquiry-message" className={formStyles.label}>
            Message
          </label>
          <textarea
            id="inquiry-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={clsx(formStyles.textarea, fieldErrors.message && formStyles.inputError)}
          />
          {fieldErrors.message && (
            <span className={formStyles.fieldError} role="alert">
              {fieldErrors.message}
            </span>
          )}
        </div>

        {serverError && (
          <div className={formStyles.serverError} role="alert">
            {serverError}
          </div>
        )}

        <button
          type="submit"
          className={formStyles.submitButton}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Sending\u2026" : "Send Inquiry"}
        </button>
      </form>
    </section>
  );
}
