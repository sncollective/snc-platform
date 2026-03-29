import { createFileRoute, Link } from "@tanstack/react-router";

import { useGuestRedirect } from "../hooks/use-guest-redirect.js";
import { ForgotPasswordForm } from "../components/auth/forgot-password-form.js";
import styles from "../components/auth/auth-form.module.css";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "Reset Password — S/NC" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const shouldRender = useGuestRedirect();

  if (!shouldRender) {
    return null;
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Reset your password</h1>
      <ForgotPasswordForm />
      <p className={styles.altLink}>
        Remember your password?{" "}
        <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
