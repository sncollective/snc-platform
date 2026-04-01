import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import type React from "react";

import { RouteErrorBoundary } from "../components/error/route-error-boundary.js";
import { ContextShell } from "../components/layout/context-shell.js";
import { ADMIN_NAV } from "../config/context-nav.js";
import { fetchAuthStateServer } from "../lib/api-server.js";
import { AccessDeniedError } from "../lib/errors.js";
import { buildLoginRedirect } from "../lib/return-to.js";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    const { user, roles } = await fetchAuthStateServer();
    if (!user) throw redirect(buildLoginRedirect(location.pathname));
    if (!roles.includes("admin")) throw new AccessDeniedError();
  },
  errorComponent: RouteErrorBoundary,
  component: AdminLayout,
});

function AdminLayout(): React.ReactElement {
  return (
    <ContextShell config={ADMIN_NAV}>
      <Outlet />
    </ContextShell>
  );
}
