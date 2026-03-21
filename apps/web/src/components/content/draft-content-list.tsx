import { useRef, useState } from "react";
import type React from "react";
import type { ContentResponse, Visibility } from "@snc/shared";

import { useCursorPagination } from "../../hooks/use-cursor-pagination.js";
import { publishContent, updateContent } from "../../lib/content.js";
import { useUpload } from "../../contexts/upload-context.js";
import listingStyles from "../../styles/listing-page.module.css";
import styles from "./draft-content-list.module.css";

// ── Public Types ──

export interface DraftContentListProps {
  readonly creatorId: string;
  readonly refreshKey: number;
  readonly onPublished: () => void;
}

// ── Private Helpers ──

function mediaRequiredForPublish(type: ContentResponse["type"]): boolean {
  return type === "video" || type === "audio";
}

function canPublish(item: ContentResponse): boolean {
  if (mediaRequiredForPublish(item.type)) {
    return item.mediaUrl !== null;
  }
  return true;
}

// ── Private Component ──

interface DraftItemProps {
  readonly item: ContentResponse;
  readonly onPublished: () => void;
  readonly onUpdated: () => void;
}

function DraftItem({
  item,
  onPublished,
  onUpdated,
}: DraftItemProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editDescription, setEditDescription] = useState(item.description ?? "");
  const [editVisibility, setEditVisibility] = useState<Visibility>(item.visibility);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { actions: uploadActions } = useUpload();

  const mediaStatus = item.mediaUrl !== null ? "Media ready" : "No media";
  const publishEnabled = canPublish(item) && !isPublishing;
  const needsMedia = mediaRequiredForPublish(item.type) && item.mediaUrl === null;

  const handleSave = async () => {
    setEditError(null);
    setIsSaving(true);
    try {
      await updateContent(item.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        visibility: editVisibility,
      });
      setIsEditing(false);
      onUpdated();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle(item.title);
    setEditDescription(item.description ?? "");
    setEditVisibility(item.visibility);
    setEditError(null);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    uploadActions.startUpload({
      file,
      purpose: "content-media",
      resourceId: item.id,
      onComplete: () => onPublished(), // refresh list to reflect new media status
      onError: (err) => setError(err.message),
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePublish = async () => {
    setError(null);
    setIsPublishing(true);
    try {
      await publishContent(item.id);
      onPublished();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setIsPublishing(false);
    }
  };

  if (isEditing) {
    return (
      <div className={styles.editForm}>
        <div className={styles.editField}>
          <label className={styles.editLabel} htmlFor={`edit-title-${item.id}`}>Title</label>
          <input
            id={`edit-title-${item.id}`}
            className={styles.editInput}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className={styles.editField}>
          <label className={styles.editLabel} htmlFor={`edit-desc-${item.id}`}>Description</label>
          <textarea
            id={`edit-desc-${item.id}`}
            className={styles.editTextarea}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            disabled={isSaving}
            rows={3}
          />
        </div>
        <div className={styles.editField}>
          <label className={styles.editLabel} htmlFor={`edit-vis-${item.id}`}>Visibility</label>
          <select
            id={`edit-vis-${item.id}`}
            className={styles.editInput}
            value={editVisibility}
            onChange={(e) => setEditVisibility(e.target.value as Visibility)}
            disabled={isSaving}
          >
            <option value="public">Public</option>
            <option value="subscribers">Subscribers Only</option>
          </select>
        </div>
        {editError && <p className={styles.draftError} role="alert">{editError}</p>}
        <div className={styles.editActions}>
          <button
            type="button"
            className={styles.editCancelButton}
            onClick={handleCancelEdit}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.editSaveButton}
            onClick={handleSave}
            disabled={isSaving || !editTitle.trim()}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.draftItem}>
      <div className={styles.draftItemHeader}>
        <span className={styles.draftTitle}>{item.title}</span>
        <span className={`${styles.typeBadge} ${styles[`typeBadge_${item.type}`]}`}>
          {item.type}
        </span>
      </div>

      <div className={styles.draftMeta}>
        <span
          className={
            item.mediaUrl !== null
              ? `${styles.mediaStatus} ${styles.mediaStatusReady}`
              : styles.mediaStatus
          }
        >
          {mediaStatus}
        </span>
      </div>

      {error && (
        <p className={styles.draftError} role="alert">
          {error}
        </p>
      )}

      <div className={styles.draftActions}>
        <button
          type="button"
          className={styles.editButton}
          onClick={() => setIsEditing(true)}
          disabled={isPublishing}
        >
          Edit
        </button>

        {needsMedia && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className={styles.hiddenFileInput}
              accept={item.type === "audio" ? "audio/*" : "video/*"}
              onChange={handleFileChange}
            />
            <button
              type="button"
              className={styles.uploadButton}
              onClick={handleUploadClick}
              disabled={isPublishing}
            >
              Upload Media
            </button>
          </>
        )}

        <a
          href={`/content/${item.id}`}
          className={styles.previewLink}
          target="_blank"
          rel="noreferrer"
        >
          Preview
        </a>

        <button
          type="button"
          className={styles.publishButton}
          onClick={handlePublish}
          disabled={!publishEnabled}
        >
          {isPublishing ? "Publishing..." : "Publish"}
        </button>
      </div>
    </div>
  );
}

// ── Public API ──

export function DraftContentList({
  creatorId,
  refreshKey,
  onPublished,
}: DraftContentListProps): React.ReactElement {
  const { items, nextCursor, isLoading, error, loadMore } =
    useCursorPagination<ContentResponse>({
      buildUrl: (cursor) => {
        const params = new URLSearchParams();
        params.set("creatorId", creatorId);
        params.set("limit", "12");
        if (cursor) params.set("cursor", cursor);
        return `/api/content/drafts?${params.toString()}`;
      },
      deps: [creatorId, refreshKey],
      fetchOptions: { credentials: "include" },
    });

  if (error) {
    return <p className={listingStyles.status}>{error}</p>;
  }

  if (isLoading && items.length === 0) {
    return <p className={listingStyles.status}>Loading...</p>;
  }

  if (items.length === 0) {
    return <p className={listingStyles.status}>No drafts.</p>;
  }

  return (
    <>
      <div className={styles.draftList}>
        {items.map((item) => (
          <DraftItem
            key={item.id}
            item={item}
            onPublished={onPublished}
            onUpdated={onPublished}
          />
        ))}
      </div>
      {nextCursor && (
        <div className={listingStyles.loadMoreWrapper}>
          <button
            type="button"
            className={listingStyles.loadMoreButton}
            onClick={loadMore}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}
