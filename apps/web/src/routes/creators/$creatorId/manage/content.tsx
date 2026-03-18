import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import type React from "react";

import { ContentForm } from "../../../../components/content/content-form.js";
import { MyContentList } from "../../../../components/content/my-content-list.js";
import sectionStyles from "../../../../styles/detail-section.module.css";
import styles from "./content-manage.module.css";

// ── Route ──

const manageRoute = getRouteApi("/creators/$creatorId/manage");

export const Route = createFileRoute("/creators/$creatorId/manage/content")({
  component: ManageContentPage,
});

// ── Component ──

export function ManageContentPage(): React.ReactElement {
  const { creator } = manageRoute.useLoaderData();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className={styles.contentManage}>
      <section className={sectionStyles.section}>
        <h2 className={sectionStyles.sectionHeading}>Create New Content</h2>
        <ContentForm
          creatorId={creator.id}
          onCreated={() => setRefreshKey((k) => k + 1)}
        />
      </section>

      <section className={sectionStyles.section}>
        <h2 className={sectionStyles.sectionHeading}>Published Content</h2>
        <MyContentList creatorId={creator.id} refreshKey={refreshKey} />
      </section>
    </div>
  );
}
