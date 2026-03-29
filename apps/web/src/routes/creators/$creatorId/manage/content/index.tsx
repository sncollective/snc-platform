import { createFileRoute, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import type React from "react";
import type { ContentType } from "@snc/shared";
import { CONTENT_TYPES } from "@snc/shared";

import { ContentManagementList } from "../../../../../components/content/content-management-list.js";
import { createContent } from "../../../../../lib/content.js";

import styles from "../content-manage.module.css";

// ── Route ──

const manageRoute = getRouteApi("/creators/$creatorId/manage");

export const Route = createFileRoute("/creators/$creatorId/manage/content/")({
  component: ManageContentPage,
});

// ── Constants ──

const TYPE_LABELS: Record<ContentType, string> = {
  video: "Video",
  audio: "Audio",
  written: "Written Post",
};

// ── Component ──

function ManageContentPage(): React.ReactElement {
  const { creator } = manageRoute.useLoaderData();
  const creatorSlug = creator.handle ?? creator.id;
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const typeSelectorRef = useRef<HTMLDivElement>(null);

  const refresh = () => setRefreshKey((k) => k + 1);

  // Click-outside dismiss for the type selector
  useEffect(() => {
    if (!showTypeSelector) return;
    const handler = (e: MouseEvent) => {
      if (
        typeSelectorRef.current &&
        !typeSelectorRef.current.contains(e.target as Node)
      ) {
        setShowTypeSelector(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showTypeSelector]);

  const handleCreate = async (type: ContentType) => {
    setIsCreating(true);
    try {
      const draft = await createContent({
        creatorId: creator.id,
        title: `Untitled ${TYPE_LABELS[type]}`,
        type,
        visibility: "public",
      });
      void navigate({
        to: "/creators/$creatorId/manage/content/$contentId",
        params: {
          creatorId: creatorSlug,
          contentId: draft.slug ?? draft.id,
        },
      });
    } catch {
      setIsCreating(false);
      setShowTypeSelector(false);
    }
  };

  return (
    <div className={styles.contentManage}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Content</h2>
        <div className={styles.createWrapper} ref={typeSelectorRef}>
          <button
            type="button"
            className={styles.createButton}
            onClick={() => setShowTypeSelector((v) => !v)}
            disabled={isCreating}
          >
            {isCreating ? "Creating..." : "Create New"}
          </button>
          {showTypeSelector && (
            <div className={styles.typeSelector}>
              {CONTENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={styles.typeSelectorOption}
                  onClick={() => void handleCreate(type)}
                  disabled={isCreating}
                >
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ContentManagementList
        creatorId={creator.id}
        creatorSlug={creatorSlug}
        refreshKey={refreshKey}
        onDeleted={refresh}
      />
    </div>
  );
}
