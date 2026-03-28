import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import type React from "react";

import { ContentForm } from "../../../../../components/content/content-form.js";
import { DraftContentList } from "../../../../../components/content/draft-content-list.js";
import { MyContentList } from "../../../../../components/content/my-content-list.js";
import sectionStyles from "../../../../../styles/detail-section.module.css";
import styles from "../content-manage.module.css";

// ── Route ──

const manageRoute = getRouteApi("/creators/$creatorId/manage");

export const Route = createFileRoute("/creators/$creatorId/manage/content/")({
  component: ManageContentPage,
});

// ── Component ──

function ManageContentPage(): React.ReactElement {
  const { creator } = manageRoute.useLoaderData();
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className={styles.contentManage}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Content</h2>
        {!showForm && (
          <button
            type="button"
            className={styles.createButton}
            onClick={() => setShowForm(true)}
          >
            Create New
          </button>
        )}
      </div>

      {showForm && (
        <ContentForm
          creatorId={creator.id}
          onSuccess={() => {
            setShowForm(false);
            refresh();
          }}
          onCancel={() => setShowForm(false)}
          onUploadComplete={refresh}
        />
      )}

      <section className={sectionStyles.section}>
        <h2 className={sectionStyles.sectionHeading}>Drafts</h2>
        <DraftContentList
          creatorId={creator.id}
          refreshKey={refreshKey}
          onPublished={refresh}
        />
      </section>

      <section className={sectionStyles.section}>
        <h2 className={sectionStyles.sectionHeading}>Published</h2>
        <MyContentList creatorId={creator.id} refreshKey={refreshKey} onDeleted={refresh} />
      </section>
    </div>
  );
}
