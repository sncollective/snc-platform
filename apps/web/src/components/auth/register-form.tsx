import { useState } from "react";
import type { FormEvent } from "react";

import { useNavigate } from "@tanstack/react-router";
import { z, email as zodEmail, minLength, safeParse } from "zod/mini";

import { authClient } from "../../lib/auth-client.js";
import { extractFieldErrors } from "../../lib/form-utils.js";
import formStyles from "../../styles/form.module.css";
import styles from "./auth-form.module.css";
import { FormField } from "./form-field.js";

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

  const validate = (): RegisterFields | null => {
    const result = safeParse(REGISTER_SCHEMA, { name, email, password });

    if (result.success) {
      setFieldErrors({});
      return result.data;
    }

    setFieldErrors(
      extractFieldErrors(result.error.issues, ["name", "email", "password"]),
    );
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
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
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {serverError && (
        <div className={formStyles.serverError} role="alert">
          {serverError}
        </div>
      )}

      <FormField
        id="register-name"
        label="Name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        autoComplete="name"
        required
      />

      <FormField
        id="register-email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
        autoComplete="email"
        required
      />

      <FormField
        id="register-password"
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        autoComplete="new-password"
        required
      />

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
