import { useState } from "react";
import type { FormEvent } from "react";

import { z, minLength, safeParse } from "zod/mini";

import { authClient } from "../../lib/auth-client.js";
import { extractFieldErrors } from "../../lib/form-utils.js";
import formStyles from "../../styles/form.module.css";
import styles from "./auth-form.module.css";
import { FormField } from "./form-field.js";

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

      <FormField
        id="current-password"
        label="Current password"
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        error={fieldErrors.currentPassword}
        autoComplete="current-password"
        required
      />

      <FormField
        id="new-password"
        label="New password"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        error={fieldErrors.newPassword}
        autoComplete="new-password"
        required
      />

      <FormField
        id="confirm-password"
        label="Confirm new password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={fieldErrors.confirmPassword}
        autoComplete="new-password"
        required
      />

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
