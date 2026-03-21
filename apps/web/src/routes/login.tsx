import { useEffect } from "react";

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod/mini";

import { LoginForm } from "../components/auth/login-form.js";
import { useSession } from "../lib/auth.js";
import { getValidReturnTo } from "../lib/return-to.js";
import { getOidcAuthorizeUrl, navigateExternal } from "../lib/url.js";
import styles from "../components/auth/auth-form.module.css";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    returnTo: z.optional(z.string()),
  }),
  component: LoginPage,
});

function LoginPage() {
  const { returnTo } = Route.useSearch();
  const oidcAuthorizeUrl = getOidcAuthorizeUrl();
  const session = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (session.data) {
      if (oidcAuthorizeUrl) {
        navigateExternal(oidcAuthorizeUrl);
      } else {
        void navigate({ to: getValidReturnTo(returnTo) });
      }
    }
  }, [session.data, navigate, oidcAuthorizeUrl, returnTo]);

  if (session.isPending || session.data) {
    return null;
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Log in to S/NC</h1>
      <LoginForm oidcAuthorizeUrl={oidcAuthorizeUrl} returnTo={returnTo} />
      <p className={styles.altLink}>
        Don&apos;t have an account?{" "}
        <Link to="/register">Sign up</Link>
      </p>
    </div>
  );
}
