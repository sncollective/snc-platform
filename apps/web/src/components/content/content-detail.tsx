import type React from "react";
import type { FeedItem, SubscriptionPlan } from "@snc/shared";
import { Link } from "@tanstack/react-router";

import { useContentManagement } from "../../hooks/use-content-management.js";
import { VideoDetail } from "./video-detail.js";
import { AudioDetail } from "./audio-detail.js";
import { WrittenDetail } from "./written-detail.js";
import styles from "./content-detail.module.css";

// ── Public Types ──

export interface ContentDetailProps {
  readonly item: FeedItem;
  readonly plans: readonly SubscriptionPlan[];
  readonly canManage?: boolean;
  readonly onContentUpdated?: (updated: FeedItem) => void;
  readonly initialEdit?: boolean;
}

// ── Private Helpers ──

function isContentLocked(item: FeedItem): boolean {
  return item.visibility === "subscribers" && item.mediaUrl === null && item.body === null;
}

// ── Public API ──

/** Dispatch content detail rendering to VideoDetail, AudioDetail, or WrittenDetail based on content type. Provides owner actions (edit, publish/unpublish, delete) when the user can manage the content. */
export function ContentDetail({ item, plans, canManage, initialEdit }: ContentDetailProps): React.ReactElement {
  const locked = isContentLocked(item);
  const mgmt = useContentManagement(item, initialEdit);

  return (
    <article className={styles.detailPage}>
      {canManage && (
        <div className={styles.ownerActions}>
          <Link
            to="/creators/$creatorId/manage/content"
            params={{ creatorId: item.creatorHandle ?? item.creatorId }}
            className={styles.backLink}
          >
            ← Manage
          </Link>

          {mgmt.isEditing ? (
            <>
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
                className={styles.cancelEditButton}
                onClick={mgmt.cancelEditing}
                disabled={mgmt.isSaving}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.editButton}
              onClick={mgmt.startEditing}
            >
              Edit
            </button>
          )}

          {item.publishedAt ? (
            <button
              type="button"
              className={styles.unpublishButton}
              onClick={() => void mgmt.unpublish()}
              disabled={mgmt.isPublishing}
            >
              {mgmt.isPublishing ? "..." : "Unpublish"}
            </button>
          ) : (
            <button
              type="button"
              className={styles.publishButton}
              onClick={() => void mgmt.publish()}
              disabled={mgmt.isPublishing || (item.type !== "written" && !item.mediaUrl)}
            >
              {mgmt.isPublishing ? "..." : "Publish"}
            </button>
          )}

          <button
            type="button"
            className={styles.deleteButton}
            onClick={() => void mgmt.remove()}
            disabled={mgmt.isDeleting}
          >
            {mgmt.isDeleting ? "Deleting..." : "Delete"}
          </button>

          {mgmt.error && (
            <span className={styles.actionError} role="alert">
              {mgmt.error}
            </span>
          )}
        </div>
      )}

      {item.type === "video" && (
        <VideoDetail
          item={mgmt.editingItem}
          locked={locked}
          plans={plans}
          isEditing={mgmt.isEditing}
          {...(mgmt.editCallbacks ? { editCallbacks: mgmt.editCallbacks } : {})}
        />
      )}
      {item.type === "audio" && (
        <AudioDetail
          item={mgmt.editingItem}
          locked={locked}
          plans={plans}
          isEditing={mgmt.isEditing}
          {...(mgmt.editCallbacks ? { editCallbacks: mgmt.editCallbacks } : {})}
        />
      )}
      {item.type === "written" && (
        <WrittenDetail
          item={mgmt.editingItem}
          locked={locked}
          plans={plans}
          isEditing={mgmt.isEditing}
          {...(mgmt.editCallbacks ? { editCallbacks: mgmt.editCallbacks } : {})}
        />
      )}
    </article>
  );
}
