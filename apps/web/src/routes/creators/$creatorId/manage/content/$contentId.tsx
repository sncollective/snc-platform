import type React from "react";
import { createFileRoute, Link, getRouteApi } from "@tanstack/react-router";
import type { FeedItem } from "@snc/shared";

import { RouteErrorBoundary } from "../../../../../components/error/route-error-boundary.js";
import { useContentManagement } from "../../../../../hooks/use-content-management.js";
import { VideoDetail } from "../../../../../components/content/video-detail.js";
import { AudioDetail } from "../../../../../components/content/audio-detail.js";
import { WrittenDetail } from "../../../../../components/content/written-detail.js";
import { ContentSettingsSidebar } from "../../../../../components/content/content-settings-sidebar.js";
import { fetchApiServer } from "../../../../../lib/api-server.js";

import styles from "../content-manage.module.css";

// ── Types ──

interface ContentEditLoaderData {
  readonly item: FeedItem;
}

// ── Route ──

const manageRoute = getRouteApi("/creators/$creatorId/manage");

export const Route = createFileRoute(
  "/creators/$creatorId/manage/content/$contentId",
)({
  errorComponent: RouteErrorBoundary,
  loader: async ({ params }): Promise<ContentEditLoaderData> => {
    // Use by-creator endpoint for dual-mode resolution (accepts slug or ID for both)
    const item = (await fetchApiServer({
      data: `/api/content/by-creator/${encodeURIComponent(params.creatorId)}/${encodeURIComponent(params.contentId)}`,
    })) as FeedItem;
    return { item };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.item
          ? `Edit: ${loaderData.item.title} — S/NC`
          : "Edit Content — S/NC",
      },
    ],
  }),
  component: ContentEditPage,
});

// ── Helpers ──

/** Determine whether a content item is ready to publish. */
function canPublish(item: FeedItem): boolean {
  if (item.publishedAt) return false;
  if (item.type !== "written" && !item.mediaUrl) return false;
  if (
    item.type !== "written" &&
    item.processingStatus !== "ready" &&
    item.processingStatus !== null
  )
    return false;
  return true;
}

// ── Component ──

function ContentEditPage(): React.ReactElement {
  const { item } = Route.useLoaderData();
  const { creator } = manageRoute.useLoaderData();
  const creatorSlug = creator.handle ?? creator.id;
  const mgmt = useContentManagement(item, true);

  return (
    <div className={styles.editPage}>
      <div className={styles.editHeader}>
        <Link
          to="/creators/$creatorId/manage/content"
          params={{ creatorId: creatorSlug }}
          className={styles.backLink}
        >
          ← Back to Content
        </Link>
        <div className={styles.editHeaderActions}>
          <button
            type="button"
            className={styles.saveButton}
            onClick={() => void mgmt.save()}
            disabled={mgmt.isSaving}
          >
            {mgmt.isSaving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            className={styles.deleteButton}
            onClick={() => void mgmt.remove()}
            disabled={mgmt.isDeleting}
          >
            {mgmt.isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      {mgmt.error && (
        <div className={styles.editError} role="alert">
          {mgmt.error}
        </div>
      )}

      <div className={styles.editColumns}>
        {/* Left: Media content area */}
        <div className={styles.editContent}>
          {mgmt.editingItem.type === "video" && (
            <VideoDetail
              item={mgmt.editingItem}
              isEditing={mgmt.isEditing}
              hideMetadata
              {...(mgmt.editCallbacks ? { editCallbacks: mgmt.editCallbacks } : {})}
            />
          )}
          {mgmt.editingItem.type === "audio" && (
            <AudioDetail
              item={mgmt.editingItem}
              isEditing={mgmt.isEditing}
              hideMetadata
              {...(mgmt.editCallbacks ? { editCallbacks: mgmt.editCallbacks } : {})}
            />
          )}
          {mgmt.editingItem.type === "written" && (
            <WrittenDetail
              item={mgmt.editingItem}
              isEditing={mgmt.isEditing}
              hideMetadata
              {...(mgmt.editCallbacks ? { editCallbacks: mgmt.editCallbacks } : {})}
            />
          )}
        </div>

        {/* Right: Settings sidebar */}
        <ContentSettingsSidebar
          item={mgmt.editingItem}
          isEditing={mgmt.isEditing}
          onTitleChange={mgmt.editCallbacks?.onTitleChange ?? (() => {})}
          onDescriptionChange={mgmt.editCallbacks?.onDescriptionChange ?? (() => {})}
          onVisibilityChange={mgmt.editCallbacks?.onVisibilityChange ?? (() => {})}
          onPublish={() => mgmt.publish()}
          onUnpublish={() => mgmt.unpublish()}
          isPublishing={mgmt.isPublishing}
          canPublish={canPublish(mgmt.editingItem)}
        />
      </div>
    </div>
  );
}
