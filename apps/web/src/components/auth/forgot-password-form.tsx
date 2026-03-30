import { useState } from "react";
import type { FormEvent } from "react";

import { Link } from "@tanstack/react-router";
import { z, email as zodEmail, minLength, safeParse } from "zod/mini";

import { authClient } from "../../lib/auth-client.js";
import { extractFieldErrors } from "../../lib/form-utils.js";
import formStyles from "../../styles/form.module.css";
import styles from "./auth-form.module.css";
import { FormField } from "./form-field.js";

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

// ── Private Components ──

interface EmailStepProps {
  readonly email: string;
  readonly onEmailChange: (value: string) => void;
  readonly emailError: string | undefined;
  readonly serverError: string;
  readonly isSubmitting: boolean;
  readonly onSubmit: (e: FormEvent) => void;
}

function EmailStep({ email, onEmailChange, emailError, serverError, isSubmitting, onSubmit }: EmailStepProps) {
  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <div
        className={formStyles.serverError}
        role={serverError ? "alert" : undefined}
        aria-live="polite"
        style={serverError ? undefined : { visibility: "hidden" }}
      >
        {serverError || "\u00A0"}
      </div>

      <FormField
        id="forgot-email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        error={emailError}
        autoComplete="email"
        required
      />

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

interface OtpStepProps {
  readonly otp: string;
  readonly onOtpChange: (value: string) => void;
  readonly newPassword: string;
  readonly onNewPasswordChange: (value: string) => void;
  readonly confirmPassword: string;
  readonly onConfirmPasswordChange: (value: string) => void;
  readonly resetErrors: ResetFieldErrors;
  readonly serverError: string;
  readonly isSubmitting: boolean;
  readonly onSubmit: (e: FormEvent) => void;
}

function OtpStep({
  otp,
  onOtpChange,
  newPassword,
  onNewPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  resetErrors,
  serverError,
  isSubmitting,
  onSubmit,
}: OtpStepProps) {
  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <div
        className={formStyles.serverError}
        role={serverError ? "alert" : undefined}
        aria-live="polite"
        style={serverError ? undefined : { visibility: "hidden" }}
      >
        {serverError || "\u00A0"}
      </div>

      <FormField
        id="forgot-otp"
        label="Reset code"
        type="text"
        value={otp}
        onChange={(e) => onOtpChange(e.target.value)}
        error={resetErrors.otp}
        autoComplete="one-time-code"
        required
      />

      <FormField
        id="forgot-new-password"
        label="New password"
        type="password"
        value={newPassword}
        onChange={(e) => onNewPasswordChange(e.target.value)}
        error={resetErrors.newPassword}
        autoComplete="new-password"
        required
      />

      <FormField
        id="forgot-confirm-password"
        label="Confirm password"
        type="password"
        value={confirmPassword}
        onChange={(e) => onConfirmPasswordChange(e.target.value)}
        error={resetErrors.confirmPassword}
        autoComplete="new-password"
        required
      />

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
      <EmailStep
        email={email}
        onEmailChange={setEmail}
        emailError={emailErrors.email}
        serverError={serverError}
        isSubmitting={isSubmitting}
        onSubmit={(e) => void handleSendCode(e)}
      />
    );
  }

  return (
    <OtpStep
      otp={otp}
      onOtpChange={setOtp}
      newPassword={newPassword}
      onNewPasswordChange={setNewPassword}
      confirmPassword={confirmPassword}
      onConfirmPasswordChange={setConfirmPassword}
      resetErrors={resetErrors}
      serverError={serverError}
      isSubmitting={isSubmitting}
      onSubmit={(e) => void handleResetPassword(e)}
    />
  );
}
