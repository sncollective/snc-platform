import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type React from "react";
import type { CreatorProfileResponse } from "@snc/shared";

import { fetchAuthStateServer } from "../../lib/api-server.js";
import { isFeatureEnabled } from "../../lib/config.js";
import { fetchAllCreators } from "../../lib/creator.js";
import { ContentForm } from "../../components/content/content-form.js";
import { MyContentList } from "../../components/content/my-content-list.js";
import { CreatorSelector } from "../../components/creator/creator-selector.js";
import { CreateCreatorForm } from "../../components/creator/create-creator-form.js";
import errorStyles from "../../styles/error-alert.module.css";
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
    if (!roles.includes("stakeholder") && !roles.includes("admin")) {
      throw redirect({ to: "/feed" });
    }
    return { userId: user.id };
  },
  component: ContentSettingsPage,
});

// ── Component ──

function ContentSettingsPage(): React.ReactElement {
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Creator Pages State ──
  const [creatorPages, setCreatorPages] = useState<CreatorProfileResponse[]>([]);
  const [selectedCreatorId, setSelectedCreatorId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const allCreators = await fetchAllCreators();
        const pages = allCreators.filter((c) => c.canManage);
        if (cancelled) return;
        setCreatorPages(pages);
        if (pages.length > 0) {
          setSelectedCreatorId(pages[0]!.id);
        }
      } catch {
        if (!cancelled) setError("Failed to load creator pages");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const handleCreated = () => {
    setRefreshKey((k) => k + 1);
  };

  const handleCreatorCreated = (profile: CreatorProfileResponse): void => {
    setCreatorPages((prev) => [...prev, profile]);
    setSelectedCreatorId(profile.id);
  };

  if (isLoading) {
    return (
      <div className={settingsStyles.page}>
        <p>Loading...</p>
      </div>
    );
  }

  if (creatorPages.length === 0) {
    return (
      <div className={settingsStyles.page}>
        <h1 className={`${pageHeadingStyles.heading} ${styles.heading}`}>My Content</h1>
        {error && (
          <div className={errorStyles.error} role="alert">{error}</div>
        )}
        <p>You need a creator page before you can create content.</p>
        <CreateCreatorForm onCreated={handleCreatorCreated} />
      </div>
    );
  }

  return (
    <div className={settingsStyles.page}>
      <h1 className={`${pageHeadingStyles.heading} ${styles.heading}`}>My Content</h1>

      {error && (
        <div className={errorStyles.error} role="alert">{error}</div>
      )}

      <CreatorSelector
        creators={creatorPages}
        selectedId={selectedCreatorId}
        onChange={setSelectedCreatorId}
      />

      <section className={sectionStyles.section}>
        <h2 className={`${sectionStyles.sectionHeading} ${styles.sectionHeading}`}>Create New Content</h2>
        <ContentForm creatorId={selectedCreatorId} onCreated={handleCreated} />
      </section>

      <section className={sectionStyles.section}>
        <h2 className={`${sectionStyles.sectionHeading} ${styles.sectionHeading}`}>Published Content</h2>
        <MyContentList creatorId={selectedCreatorId} refreshKey={refreshKey} />
      </section>
    </div>
  );
}
