import { createFileRoute, redirect } from "@tanstack/react-router";

import { fetchAuthStateServer } from "../../lib/api-server.js";
import { ChangePasswordForm } from "../../components/auth/change-password-form.js";
import settingsStyles from "../../styles/settings-page.module.css";
import listingStyles from "../../styles/listing-page.module.css";

export const Route = createFileRoute("/settings/")({
  beforeLoad: async () => {
    const { user } = await fetchAuthStateServer();
    if (!user) {
      throw redirect({ to: "/login" });
    }
  },
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
