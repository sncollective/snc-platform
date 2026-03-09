import { useCallback, useState } from "react";
import type { FormEvent } from "react";

import { useNavigate } from "@tanstack/react-router";
import { z, email as zodEmail, minLength, safeParse } from "zod/mini";

import { authClient } from "../../lib/auth-client.js";
import { extractFieldErrors } from "../../lib/form-utils.js";
import formStyles from "../../styles/form.module.css";
import styles from "./auth-form.module.css";

// ── Private Constants ──

const REGISTER_SCHEMA = z.object({
  name: z.string().check(minLength(1, "Name is required")),
  email: zodEmail("Please enter a valid email address"),
  password: z
    .string()
    .check(minLength(8, "Password must be at least 8 characters")),
});

type RegisterFields = z.infer<typeof REGISTER_SCHEMA>;

type FieldErrors = Partial<Record<"name" | "email" | "password", string>>;

// ── Public API ──

export function RegisterForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = useCallback((): RegisterFields | null => {
    const result = safeParse(REGISTER_SCHEMA, { name, email, password });

    if (result.success) {
      setFieldErrors({});
      return result.data;
    }

    setFieldErrors(
      extractFieldErrors(result.error.issues, ["name", "email", "password"]),
    );
    return null;
  }, [name, email, password]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setServerError("");

      const data = validate();
      if (!data) return;

      setIsSubmitting(true);

      try {
        const result = await authClient.signUp.email({
          name: data.name,
          email: data.email,
          password: data.password,
        });

        if (result.error) {
          setServerError(
            result.error.message ?? "Registration failed. Please try again.",
          );
          return;
        }

        void navigate({ to: "/feed" });
      } catch {
        setServerError("Registration failed. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [validate, navigate],
  );

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {serverError && (
        <div className={formStyles.serverError} role="alert">
          {serverError}
        </div>
      )}

      <div className={formStyles.fieldGroup}>
        <label htmlFor="register-name" className={formStyles.label}>
          Name
        </label>
        <input
          id="register-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={
            fieldErrors.name
              ? `${formStyles.input} ${formStyles.inputError}`
              : formStyles.input
          }
          autoComplete="name"
          required
        />
        {fieldErrors.name && (
          <span className={formStyles.fieldError} role="alert">
            {fieldErrors.name}
          </span>
        )}
      </div>

      <div className={formStyles.fieldGroup}>
        <label htmlFor="register-email" className={formStyles.label}>
          Email
        </label>
        <input
          id="register-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={
            fieldErrors.email
              ? `${formStyles.input} ${formStyles.inputError}`
              : formStyles.input
          }
          autoComplete="email"
          required
        />
        {fieldErrors.email && (
          <span className={formStyles.fieldError} role="alert">
            {fieldErrors.email}
          </span>
        )}
      </div>

      <div className={formStyles.fieldGroup}>
        <label htmlFor="register-password" className={formStyles.label}>
          Password
        </label>
        <input
          id="register-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={
            fieldErrors.password
              ? `${formStyles.input} ${formStyles.inputError}`
              : formStyles.input
          }
          autoComplete="new-password"
          required
        />
        {fieldErrors.password && (
          <span className={formStyles.fieldError} role="alert">
            {fieldErrors.password}
          </span>
        )}
      </div>

      <button
        type="submit"
        className={formStyles.submitButton}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Creating account\u2026" : "Create account"}
      </button>
    </form>
  );
}
