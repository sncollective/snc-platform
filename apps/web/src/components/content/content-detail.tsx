import { useState } from "react";
import type React from "react";
import type { FeedItem, SubscriptionPlan, Visibility } from "@snc/shared";
import { Link, useNavigate } from "@tanstack/react-router";

import { deleteContent, updateContent, publishContent, unpublishContent } from "../../lib/content.js";
import { useUpload } from "../../contexts/upload-context.js";
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

export function ContentDetail({ item, plans, canManage, initialEdit }: ContentDetailProps): React.ReactElement {
  const locked = isContentLocked(item);
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(initialEdit ?? false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editDescription, setEditDescription] = useState(item.description ?? "");
  const [editVisibility, setEditVisibility] = useState<Visibility>(item.visibility);
  const [editBody, setEditBody] = useState(item.body ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { actions: uploadActions } = useUpload();

  const editingItem: FeedItem = isEditing
    ? { ...item, title: editTitle, description: editDescription, visibility: editVisibility, body: editBody }
    : item;

  const editCallbacks = isEditing
    ? {
        onTitleChange: setEditTitle,
        onDescriptionChange: setEditDescription,
        onVisibilityChange: setEditVisibility,
        ...(item.type === "written" ? { onBodyChange: setEditBody } : {}),
        onMediaUpload: (file: File) => {
          uploadActions.startUpload({
            file,
            purpose: "content-media",
            resourceId: item.id,
            onComplete: () => window.location.reload(),
            onError: (err) => setSaveError(err.message),
          });
        },
        onThumbnailUpload: (file: File) => {
          uploadActions.startUpload({
            file,
            purpose: "content-thumbnail",
            resourceId: item.id,
            onComplete: () => window.location.reload(),
            onError: (err) => setSaveError(err.message),
          });
        },
        onThumbnailRemove: async () => {
          try {
            await updateContent(item.id, { clearThumbnail: true });
            window.location.reload();
          } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Failed to remove thumbnail");
          }
        },
        onMediaRemove: async () => {
          if (!window.confirm("Remove media file? This cannot be undone.")) return;
          try {
            await updateContent(item.id, { clearMedia: true });
            window.location.reload();
          } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Failed to remove media");
          }
        },
      }
    : undefined;

  const handleSave = async () => {
    setSaveError(null);
    setIsSaving(true);
    try {
      await updateContent(item.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        visibility: editVisibility,
        body: item.type === "written" ? editBody : undefined,
      });
      setIsEditing(false);
      window.location.reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle(item.title);
    setEditDescription(item.description ?? "");
    setEditVisibility(item.visibility);
    setEditBody(item.body ?? "");
    setSaveError(null);
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await publishContent(item.id);
      window.location.reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    setIsPublishing(true);
    try {
      await unpublishContent(item.id);
      window.location.reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unpublish failed");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this content?")) return;
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await deleteContent(item.id);
      void navigate({ to: "/feed" });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

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

          {isEditing ? (
            <>
              <button
                type="button"
                className={styles.saveButton}
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className={styles.cancelEditButton}
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.editButton}
              onClick={() => setIsEditing(true)}
            >
              Edit
            </button>
          )}

          {item.publishedAt ? (
            <button
              type="button"
              className={styles.unpublishButton}
              onClick={handleUnpublish}
              disabled={isPublishing}
            >
              {isPublishing ? "..." : "Unpublish"}
            </button>
          ) : (
            <button
              type="button"
              className={styles.publishButton}
              onClick={handlePublish}
              disabled={isPublishing || (item.type !== "written" && !item.mediaUrl)}
            >
              {isPublishing ? "..." : "Publish"}
            </button>
          )}

          <button
            type="button"
            className={styles.deleteButton}
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>

          {(saveError ?? deleteError) && (
            <span className={styles.actionError} role="alert">
              {saveError ?? deleteError}
            </span>
          )}
        </div>
      )}

      {item.type === "video" && (
        <VideoDetail
          item={editingItem}
          locked={locked}
          plans={plans}
          isEditing={isEditing}
          editCallbacks={editCallbacks}
        />
      )}
      {item.type === "audio" && (
        <AudioDetail
          item={editingItem}
          locked={locked}
          plans={plans}
          isEditing={isEditing}
          editCallbacks={editCallbacks}
        />
      )}
      {item.type === "written" && (
        <WrittenDetail
          item={editingItem}
          locked={locked}
          plans={plans}
          isEditing={isEditing}
          editCallbacks={editCallbacks}
        />
      )}
    </article>
  );
}
