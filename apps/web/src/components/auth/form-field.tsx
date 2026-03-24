import type React from "react";

import { clsx } from "clsx/lite";

import formStyles from "../../styles/form.module.css";

// ── Public Types ──

export interface FormFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> {
  /** Unique input id — also used to derive the error span id. */
  readonly id: string;
  /** Visible label text. */
  readonly label: string;
  /** Validation error message, if any. */
  readonly error?: string | undefined;
}

// ── Public API ──

export function FormField({
  id,
  label,
  error,
  ...inputProps
}: FormFieldProps): React.ReactElement {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={formStyles.fieldGroup}>
      <label htmlFor={id} className={formStyles.label}>
        {label}
      </label>
      <input
        id={id}
        className={clsx(formStyles.input, error && formStyles.inputError)}
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        {...inputProps}
      />
      {error && (
        <span id={errorId} className={formStyles.fieldError} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
