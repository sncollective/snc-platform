import { useCallback, useState } from "react";
import type { FormEvent } from "react";

import { useNavigate } from "@tanstack/react-router";
import { z, email as zodEmail, minLength, safeParse } from "zod/mini";

import { authClient } from "../../lib/auth-client.js";
import { extractFieldErrors } from "../../lib/form-utils.js";
import styles from "./auth-form.module.css";

// ── Private Constants ──

const LOGIN_SCHEMA = z.object({
  email: zodEmail("Please enter a valid email address"),
  password: z.string().check(minLength(1, "Password is required")),
});

type LoginFields = z.infer<typeof LOGIN_SCHEMA>;

type FieldErrors = Partial<Record<"email" | "password", string>>;

// ── Public API ──

export function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = useCallback((): LoginFields | null => {
    const result = safeParse(LOGIN_SCHEMA, { email, password });

    if (result.success) {
      setFieldErrors({});
      return result.data;
    }

    setFieldErrors(
      extractFieldErrors(result.error.issues, ["email", "password"]),
    );
    return null;
  }, [email, password]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setServerError("");

      const data = validate();
      if (!data) return;

      setIsSubmitting(true);

      try {
        const result = await authClient.signIn.email({
          email: data.email,
          password: data.password,
        });

        if (result.error) {
          setServerError(result.error.message ?? "Invalid email or password");
          return;
        }

        void navigate({ to: "/feed" });
      } catch {
        setServerError("Invalid email or password");
      } finally {
        setIsSubmitting(false);
      }
    },
    [validate, navigate],
  );

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {serverError && (
        <div className={styles.serverError} role="alert">
          {serverError}
        </div>
      )}

      <div className={styles.fieldGroup}>
        <label htmlFor="login-email" className={styles.label}>
          Email
        </label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={
            fieldErrors.email
              ? `${styles.input} ${styles.inputError}`
              : styles.input
          }
          autoComplete="email"
          required
        />
        {fieldErrors.email && (
          <span className={styles.fieldError} role="alert">
            {fieldErrors.email}
          </span>
        )}
      </div>

      <div className={styles.fieldGroup}>
        <label htmlFor="login-password" className={styles.label}>
          Password
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={
            fieldErrors.password
              ? `${styles.input} ${styles.inputError}`
              : styles.input
          }
          autoComplete="current-password"
          required
        />
        {fieldErrors.password && (
          <span className={styles.fieldError} role="alert">
            {fieldErrors.password}
          </span>
        )}
      </div>

      <button
        type="submit"
        className={styles.submitButton}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Logging in\u2026" : "Log in"}
      </button>
    </form>
  );
}
