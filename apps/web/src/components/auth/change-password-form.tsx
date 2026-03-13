import { useState } from "react";
import type { FormEvent } from "react";

import { z, minLength, safeParse } from "zod/mini";

import { authClient } from "../../lib/auth-client.js";
import { extractFieldErrors } from "../../lib/form-utils.js";
import formStyles from "../../styles/form.module.css";
import styles from "./auth-form.module.css";

// ── Private Constants ──

const CHANGE_PASSWORD_SCHEMA = z.object({
  currentPassword: z.string().check(minLength(1, "Current password is required")),
  newPassword: z
    .string()
    .check(minLength(8, "New password must be at least 8 characters")),
  confirmPassword: z.string().check(minLength(1, "Please confirm your new password")),
});

type ChangePasswordFields = z.infer<typeof CHANGE_PASSWORD_SCHEMA>;

type FieldErrors = Partial<
  Record<"currentPassword" | "newPassword" | "confirmPassword", string>
>;

// ── Public API ──

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): ChangePasswordFields | null => {
    const result = safeParse(CHANGE_PASSWORD_SCHEMA, {
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (!result.success) {
      setFieldErrors(
        extractFieldErrors(result.error.issues, [
          "currentPassword",
          "newPassword",
          "confirmPassword",
        ]),
      );
      return null;
    }

    if (result.data.newPassword !== result.data.confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords do not match" });
      return null;
    }

    setFieldErrors({});
    return result.data;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError("");
    setSuccessMessage("");

    const data = validate();
    if (!data) return;

    setIsSubmitting(true);

    try {
      const result = await authClient.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        revokeOtherSessions: true,
      });

      if (result.error) {
        setServerError(
          result.error.message ?? "Failed to change password. Please try again.",
        );
        return;
      }

      setSuccessMessage("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setServerError("Failed to change password. Please try again.");
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

      {successMessage && (
        <div className={formStyles.successMessage} role="status">
          {successMessage}
        </div>
      )}

      <div className={formStyles.fieldGroup}>
        <label htmlFor="current-password" className={formStyles.label}>
          Current password
        </label>
        <input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={
            fieldErrors.currentPassword
              ? `${formStyles.input} ${formStyles.inputError}`
              : formStyles.input
          }
          autoComplete="current-password"
          required
        />
        {fieldErrors.currentPassword && (
          <span className={formStyles.fieldError} role="alert">
            {fieldErrors.currentPassword}
          </span>
        )}
      </div>

      <div className={formStyles.fieldGroup}>
        <label htmlFor="new-password" className={formStyles.label}>
          New password
        </label>
        <input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={
            fieldErrors.newPassword
              ? `${formStyles.input} ${formStyles.inputError}`
              : formStyles.input
          }
          autoComplete="new-password"
          required
        />
        {fieldErrors.newPassword && (
          <span className={formStyles.fieldError} role="alert">
            {fieldErrors.newPassword}
          </span>
        )}
      </div>

      <div className={formStyles.fieldGroup}>
        <label htmlFor="confirm-password" className={formStyles.label}>
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={
            fieldErrors.confirmPassword
              ? `${formStyles.input} ${formStyles.inputError}`
              : formStyles.input
          }
          autoComplete="new-password"
          required
        />
        {fieldErrors.confirmPassword && (
          <span className={formStyles.fieldError} role="alert">
            {fieldErrors.confirmPassword}
          </span>
        )}
      </div>

      <button
        type="submit"
        className={formStyles.submitButton}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Changing password\u2026" : "Change password"}
      </button>
    </form>
  );
}
