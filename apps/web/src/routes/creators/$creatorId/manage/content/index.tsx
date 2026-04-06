import { createFileRoute, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type React from "react";
import type { ContentType } from "@snc/shared";
import { CONTENT_TYPES } from "@snc/shared";

import { ContentManagementList } from "../../../../../components/content/content-management-list.js";
import { createContent } from "../../../../../lib/content.js";
import { MenuRoot, MenuTrigger, MenuContent, MenuItem } from "../../../../../components/ui/menu.js";

import styles from "../content-manage.module.css";

// ── Route ──

const manageRoute = getRouteApi("/creators/$creatorId/manage");

export const Route = createFileRoute("/creators/$creatorId/manage/content/")({
  head: () => ({ meta: [{ title: "Manage Content — S/NC" }] }),
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
  const [isCreating, setIsCreating] = useState(false);

  const refresh = () => setRefreshKey((k) => k + 1);

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
    }
  };

  return (
    <div className={styles.contentManage}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Content</h2>
        <MenuRoot>
          <MenuTrigger asChild>
            <button
              type="button"
              className={styles.createButton}
              disabled={isCreating}
            >
              {isCreating ? "Creating..." : "Create New"}
            </button>
          </MenuTrigger>
          <MenuContent>
            {CONTENT_TYPES.map((type) => (
              <MenuItem
                key={type}
                value={type}
                onSelect={() => void handleCreate(type)}
                disabled={isCreating}
              >
                {TYPE_LABELS[type]}
              </MenuItem>
            ))}
          </MenuContent>
        </MenuRoot>
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
