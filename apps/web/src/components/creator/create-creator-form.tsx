import { useRef, useState } from "react";
import type React from "react";
import type { FormEvent } from "react";

import { z, minLength, maxLength, regex, safeParse } from "zod/mini";
import { HANDLE_REGEX } from "@snc/shared";
import type { CreatorProfileResponse } from "@snc/shared";

import { createCreatorEntity } from "../../lib/creator.js";
import { extractFieldErrors } from "../../lib/form-utils.js";
import { clsx } from "clsx/lite";

import formStyles from "../../styles/form.module.css";
import buttonStyles from "../../styles/button.module.css";
import styles from "./create-creator-form.module.css";

// ── Private Constants ──

const CREATE_CREATOR_SCHEMA = z.object({
  displayName: z
    .string()
    .check(
      minLength(1, "Display name is required"),
      maxLength(100, "Display name cannot exceed 100 characters"),
    ),
  handle: z
    .optional(
      z.string().check(
        regex(HANDLE_REGEX, "Handle must be 3\u201330 characters: lowercase letters, digits, _ or -"),
      ),
    ),
});

type FieldErrors = Partial<Record<"displayName" | "handle", string>>;

// ── Public Types ──

export interface CreateCreatorFormProps {
  readonly onCreated: (profile: CreatorProfileResponse) => void;
}

// ── Public API ──

export function CreateCreatorForm({
  onCreated,
}: CreateCreatorFormProps): React.ReactElement {
  const displayNameRef = useRef("");
  const handleRef = useRef("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): { displayName: string; handle?: string | undefined } | null => {
    const result = safeParse(CREATE_CREATOR_SCHEMA, {
      displayName: displayNameRef.current,
      handle: handleRef.current || undefined,
    });
    if (result.success) {
      setFieldErrors({});
      return result.data;
    }
    setFieldErrors(
      extractFieldErrors(result.error.issues, ["displayName", "handle"]),
    );
    return null;
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setServerError("");

    const data = validate();
    if (!data) return;

    setIsSubmitting(true);
    try {
      const body: { displayName: string; handle?: string } = {
        displayName: data.displayName,
      };
      if (data.handle) body.handle = data.handle;

      const profile = await createCreatorEntity(body);
      onCreated(profile);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Failed to create creator",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {serverError && (
        <div className={formStyles.serverError} role="alert">
          {serverError}
        </div>
      )}

      <div className={formStyles.fieldGroup}>
        <label htmlFor="creator-display-name" className={formStyles.label}>
          Display Name
        </label>
        <input
          id="creator-display-name"
          type="text"
          defaultValue=""
          onChange={(e) => { displayNameRef.current = e.target.value; }}
          placeholder="e.g. My Band"
          className={clsx(formStyles.input, fieldErrors.displayName && formStyles.inputError)}
          disabled={isSubmitting}
        />
        {fieldErrors.displayName && (
          <span className={formStyles.fieldError} role="alert">
            {fieldErrors.displayName}
          </span>
        )}
      </div>

      <div className={formStyles.fieldGroup}>
        <label htmlFor="creator-handle" className={formStyles.label}>
          Handle (optional)
        </label>
        <input
          id="creator-handle"
          type="text"
          defaultValue=""
          onChange={(e) => { handleRef.current = e.target.value; }}
          placeholder="e.g. my-band"
          className={clsx(formStyles.input, fieldErrors.handle && formStyles.inputError)}
          disabled={isSubmitting}
        />
        <span className={styles.helperText}>
          3–30 characters: lowercase letters, digits, _ or -
        </span>
        {fieldErrors.handle && (
          <span className={formStyles.fieldError} role="alert">
            {fieldErrors.handle}
          </span>
        )}
      </div>

      <button
        type="submit"
        className={buttonStyles.primaryButton}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Creating\u2026" : "Create Creator"}
      </button>
    </form>
  );
}
