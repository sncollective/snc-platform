import { useState, useEffect } from "react";
import type React from "react";

import { apiGet } from "../../lib/fetch-utils.js";
import { authClient } from "../../lib/auth-client.js";
import styles from "./set-password-banner.module.css";
import formStyles from "../../styles/form.module.css";

// ── Private Constants ──

const DISMISSED_KEY = "snc-set-password-dismissed";

// ── Public Types ──

export interface SetPasswordBannerProps {
  /** User email for the password setup form. */
  readonly email: string;
}

// ── Public API ──

/** Banner prompting OAuth-only users to set a platform password. */
export function SetPasswordBanner({
  email,
}: SetPasswordBannerProps): React.ReactElement | null {
  const [needsPassword, setNeedsPassword] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Check localStorage for dismissal
    if (localStorage.getItem(DISMISSED_KEY) === "true") {
      setDismissed(true);
      return;
    }

    // Check if user has a password
    const checkProviders = async () => {
      try {
        const data = await apiGet<{ hasPassword: boolean }>(
          "/api/me/providers",
        );
        setNeedsPassword(!data.hasPassword);
      } catch {
        // Silently fail — don't block the settings page
      }
    };
    void checkProviders();
  }, []);

  if (dismissed || !needsPassword) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "forget-password",
      });
      setSuccess(true);
    } catch {
      setError("Failed to start password setup. Try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.banner} role="status">
      <div className={styles.content}>
        <p className={styles.message}>
          <strong>Set up an S/NC password</strong> — You signed in with a social
          account. Add a password so you can log in directly anytime.
        </p>
        {!showForm ? (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.setupButton}
              onClick={() => setShowForm(true)}
            >
              Set password
            </button>
            <button
              type="button"
              className={styles.dismissButton}
              onClick={handleDismiss}
            >
              Dismiss
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && (
              <div className={formStyles.serverError} role="alert">
                {error}
              </div>
            )}
            {success ? (
              <p className={styles.successMessage}>
                Check your email for a password reset code. Use it on the{" "}
                <a href="/forgot-password">forgot password page</a> to set your
                password.
              </p>
            ) : (
              <>
                <p className={styles.formHint}>
                  We&apos;ll send a verification code to <strong>{email}</strong> to
                  set your password.
                </p>
                <button
                  type="submit"
                  className={styles.setupButton}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Sending code\u2026" : "Send verification code"}
                </button>
                <button
                  type="button"
                  className={styles.dismissButton}
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
