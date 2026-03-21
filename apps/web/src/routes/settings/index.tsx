import { createFileRoute, redirect } from "@tanstack/react-router";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { fetchAuthStateServer } from "../../lib/api-server.js";
import { buildLoginRedirect } from "../../lib/return-to.js";
import { ChangePasswordForm } from "../../components/auth/change-password-form.js";
import settingsStyles from "../../styles/settings-page.module.css";
import listingStyles from "../../styles/listing-page.module.css";

export const Route = createFileRoute("/settings/")({
  beforeLoad: async ({ location }) => {
    const { user } = await fetchAuthStateServer();
    if (!user) {
      throw redirect(buildLoginRedirect(location.pathname));
    }
  },
  errorComponent: RouteErrorBoundary,
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className={settingsStyles.page}>
      <h1 className={listingStyles.heading}>Settings</h1>
      <h2>Change password</h2>
      <ChangePasswordForm />
    </div>
  );
}
