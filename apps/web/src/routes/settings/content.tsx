import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import type React from "react";

import { fetchAuthStateServer } from "../../lib/api-server.js";
import { isFeatureEnabled } from "../../lib/config.js";
import { ContentForm } from "../../components/content/content-form.js";
import { MyContentList } from "../../components/content/my-content-list.js";
import sectionStyles from "../../styles/detail-section.module.css";
import pageHeadingStyles from "../../styles/page-heading.module.css";
import settingsStyles from "../../styles/settings-page.module.css";
import styles from "./content-settings.module.css";

// ── Route ──

export const Route = createFileRoute("/settings/content")({
  beforeLoad: async () => {
    if (!isFeatureEnabled("content")) throw redirect({ to: "/" });

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

  const handleCreated = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className={settingsStyles.page}>
      <h1 className={`${pageHeadingStyles.heading} ${styles.heading}`}>My Content</h1>

      <section className={sectionStyles.section}>
        <h2 className={`${sectionStyles.sectionHeading} ${styles.sectionHeading}`}>Create New Content</h2>
        <ContentForm onCreated={handleCreated} />
      </section>

      <section className={sectionStyles.section}>
        <h2 className={`${sectionStyles.sectionHeading} ${styles.sectionHeading}`}>Published Content</h2>
        <MyContentList creatorId={userId} refreshKey={refreshKey} />
      </section>
    </div>
  );
}
