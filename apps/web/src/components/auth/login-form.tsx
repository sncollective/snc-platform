import { useState } from "react";
import type { FormEvent } from "react";

import { Link, useNavigate } from "@tanstack/react-router";
import { z, email as zodEmail, minLength, safeParse } from "zod/mini";

import { authClient } from "../../lib/auth-client.js";
import { extractFieldErrors } from "../../lib/form-utils.js";
import { getValidReturnTo } from "../../lib/return-to.js";
import { navigateExternal } from "../../lib/url.js";
import formStyles from "../../styles/form.module.css";
import styles from "./auth-form.module.css";
import { FormField } from "./form-field.js";

// ── Private Constants ──

const LOGIN_SCHEMA = z.object({
  email: zodEmail("Please enter a valid email address"),
  password: z.string().check(minLength(1, "Password is required")),
});

type LoginFields = z.infer<typeof LOGIN_SCHEMA>;

type FieldErrors = Partial<Record<"email" | "password", string>>;

// ── Public Types ──

export interface LoginFormProps {
  readonly oidcAuthorizeUrl?: string | null;
  readonly returnTo?: string | undefined;
}

// ── Public API ──

export function LoginForm({
  oidcAuthorizeUrl,
  returnTo,
}: LoginFormProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): LoginFields | null => {
    const result = safeParse(LOGIN_SCHEMA, { email, password });

    if (result.success) {
      setFieldErrors({});
      return result.data;
    }

    setFieldErrors(
      extractFieldErrors(result.error.issues, ["email", "password"]),
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
      const result = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      });

      if (result.error) {
        setServerError(result.error.message ?? "Invalid email or password");
        return;
      }

      if (oidcAuthorizeUrl) {
        navigateExternal(oidcAuthorizeUrl);
      } else {
        void navigate({ to: getValidReturnTo(returnTo) });
      }
    } catch {
      // In OIDC flow, the after-hook 302 redirect causes a fetch error,
      // but the session was created successfully. Redirect to authorize.
      if (oidcAuthorizeUrl) {
        navigateExternal(oidcAuthorizeUrl);
      } else {
        setServerError("Invalid email or password");
      }
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
        id="login-email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
        autoComplete="email"
        required
      />

      <FormField
        id="login-password"
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        autoComplete="current-password"
        required
      />
      <Link to="/forgot-password" className={styles.forgotLink}>
        Forgot password?
      </Link>

      <button
        type="submit"
        className={formStyles.submitButton}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Logging in\u2026" : "Log in"}
      </button>
    </form>
  );
}
