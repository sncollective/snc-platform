import { createFileRoute, Link } from "@tanstack/react-router";

import { useGuestRedirect } from "../hooks/use-guest-redirect.js";
import { RegisterForm } from "../components/auth/register-form.js";
import styles from "../components/auth/auth-form.module.css";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [{ title: "Sign Up — S/NC" }],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const shouldRender = useGuestRedirect();

  if (!shouldRender) {
    return null;
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Create your S/NC account</h1>
      <RegisterForm />
      <p className={styles.altLink}>
        Already have an account?{" "}
        <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
