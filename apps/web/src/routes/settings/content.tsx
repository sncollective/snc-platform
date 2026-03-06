import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import type React from "react";

import { fetchAuthStateServer } from "../../lib/api-server.js";
import { ContentForm } from "../../components/content/content-form.js";
import { MyContentList } from "../../components/content/my-content-list.js";
import settingsStyles from "../../styles/settings-page.module.css";
import styles from "./content-settings.module.css";

// ── Route ──

export const Route = createFileRoute("/settings/content")({
  beforeLoad: async () => {
    const { user, roles } = await fetchAuthStateServer();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    if (!roles.includes("creator")) {
      throw redirect({ to: "/feed" });
    }
    return { userId: user.id };
  },
  component: ContentSettingsPage,
});

// ── Component ──

function ContentSettingsPage(): React.ReactElement {
  const { userId } = Route.useRouteContext();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className={settingsStyles.page}>
      <h1 className={styles.heading}>My Content</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Create New Content</h2>
        <ContentForm onCreated={handleCreated} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Published Content</h2>
        <MyContentList creatorId={userId} refreshKey={refreshKey} />
      </section>
    </div>
  );
}
