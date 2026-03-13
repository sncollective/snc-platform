import { useState } from "react";
import type { FormEvent } from "react";

import { Link } from "@tanstack/react-router";
import { z, email as zodEmail, minLength, safeParse } from "zod/mini";

import { authClient } from "../../lib/auth-client.js";
import { extractFieldErrors } from "../../lib/form-utils.js";
import formStyles from "../../styles/form.module.css";
import styles from "./auth-form.module.css";

// ── Private Constants ──

const EMAIL_SCHEMA = z.object({
  email: zodEmail("Please enter a valid email address"),
});

const RESET_SCHEMA = z.object({
  otp: z.string().check(minLength(1, "Please enter the reset code")),
  newPassword: z
    .string()
    .check(minLength(8, "Password must be at least 8 characters")),
  confirmPassword: z
    .string()
    .check(minLength(1, "Please confirm your password")),
});

type EmailFieldErrors = Partial<Record<"email", string>>;
type ResetFieldErrors = Partial<
  Record<"otp" | "newPassword" | "confirmPassword", string>
>;

// ── Public API ──

export function ForgotPasswordForm() {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailErrors, setEmailErrors] = useState<EmailFieldErrors>({});
  const [resetErrors, setResetErrors] = useState<ResetFieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault();
    setServerError("");

    const result = safeParse(EMAIL_SCHEMA, { email });
    if (!result.success) {
      setEmailErrors(extractFieldErrors(result.error.issues, ["email"]));
      return;
    }
    setEmailErrors({});

    setIsSubmitting(true);
    try {
      const res = await authClient.emailOtp.sendVerificationOtp({
        email: result.data.email,
        type: "forget-password",
      });

      if (res.error) {
        setServerError(
          "Password reset is not available at this time. Please contact support.",
        );
        return;
      }

      setStep("otp");
    } catch {
      setServerError(
        "Password reset is not available at this time. Please contact support.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setServerError("");

    const result = safeParse(RESET_SCHEMA, {
      otp,
      newPassword,
      confirmPassword,
    });
    if (!result.success) {
      setResetErrors(
        extractFieldErrors(result.error.issues, [
          "otp",
          "newPassword",
          "confirmPassword",
        ]),
      );
      return;
    }

    if (result.data.newPassword !== result.data.confirmPassword) {
      setResetErrors({ confirmPassword: "Passwords do not match" });
      return;
    }
    setResetErrors({});

    setIsSubmitting(true);
    try {
      const res = await authClient.emailOtp.resetPassword({
        email,
        otp: result.data.otp,
        password: result.data.newPassword,
      });

      if (res.error) {
        setServerError(
          res.error.message ?? "Failed to reset password. Please try again.",
        );
        return;
      }

      setSuccess(true);
    } catch {
      setServerError("Failed to reset password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className={styles.form}>
        <p role="status">Your password has been reset successfully.</p>
        <Link to="/login" className={formStyles.submitButton}>
          Log in
        </Link>
      </div>
    );
  }

  if (step === "email") {
    return (
      <form className={styles.form} onSubmit={handleSendCode} noValidate>
        {serverError && (
          <div className={formStyles.serverError} role="alert">
            {serverError}
          </div>
        )}

        <div className={formStyles.fieldGroup}>
          <label htmlFor="forgot-email" className={formStyles.label}>
            Email
          </label>
          <input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={
              emailErrors.email
                ? `${formStyles.input} ${formStyles.inputError}`
                : formStyles.input
            }
            autoComplete="email"
            required
          />
          {emailErrors.email && (
            <span className={formStyles.fieldError} role="alert">
              {emailErrors.email}
            </span>
          )}
        </div>

        <button
          type="submit"
          className={formStyles.submitButton}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Sending\u2026" : "Send reset code"}
        </button>
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleResetPassword} noValidate>
      {serverError && (
        <div className={formStyles.serverError} role="alert">
          {serverError}
        </div>
      )}

      <div className={formStyles.fieldGroup}>
        <label htmlFor="forgot-otp" className={formStyles.label}>
          Reset code
        </label>
        <input
          id="forgot-otp"
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          className={
            resetErrors.otp
              ? `${formStyles.input} ${formStyles.inputError}`
              : formStyles.input
          }
          autoComplete="one-time-code"
          required
        />
        {resetErrors.otp && (
          <span className={formStyles.fieldError} role="alert">
            {resetErrors.otp}
          </span>
        )}
      </div>

      <div className={formStyles.fieldGroup}>
        <label htmlFor="forgot-new-password" className={formStyles.label}>
          New password
        </label>
        <input
          id="forgot-new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={
            resetErrors.newPassword
              ? `${formStyles.input} ${formStyles.inputError}`
              : formStyles.input
          }
          autoComplete="new-password"
          required
        />
        {resetErrors.newPassword && (
          <span className={formStyles.fieldError} role="alert">
            {resetErrors.newPassword}
          </span>
        )}
      </div>

      <div className={formStyles.fieldGroup}>
        <label htmlFor="forgot-confirm-password" className={formStyles.label}>
          Confirm password
        </label>
        <input
          id="forgot-confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={
            resetErrors.confirmPassword
              ? `${formStyles.input} ${formStyles.inputError}`
              : formStyles.input
          }
          autoComplete="new-password"
          required
        />
        {resetErrors.confirmPassword && (
          <span className={formStyles.fieldError} role="alert">
            {resetErrors.confirmPassword}
          </span>
        )}
      </div>

      <button
        type="submit"
        className={formStyles.submitButton}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Resetting\u2026" : "Reset password"}
      </button>
    </form>
  );
}
