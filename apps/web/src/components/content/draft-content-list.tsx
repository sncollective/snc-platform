import { useRef, useState } from "react";
import type React from "react";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx/lite";

import type { ContentResponse } from "@snc/shared";

import { useCursorPagination } from "../../hooks/use-cursor-pagination.js";
import { useContentDelete } from "../../hooks/use-content-delete.js";
import { publishContent } from "../../lib/content.js";
import { buildContentListUrl } from "../../lib/content-url.js";
import { ProcessingIndicator } from "./processing-indicator.js";
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
  readonly onDeleted: () => void;
}

function DraftItem({
  item,
  onPublished,
  onDeleted,
}: DraftItemProps): React.ReactElement {
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);
  const { actions: uploadActions } = useUpload();
  const { deletingId, handleDelete } = useContentDelete({
    onDeleted,
    onError: setError,
  });
  const isDeleting = deletingId === item.id;

  const mediaStatus = item.mediaUrl !== null ? "Media ready" : "No media";
  const publishEnabled = canPublish(item) && !isPublishing;
  const needsMedia = mediaRequiredForPublish(item.type) && item.mediaUrl === null;

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

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    uploadActions.startUpload({
      file,
      purpose: "content-thumbnail",
      resourceId: item.id,
      onComplete: () => onPublished(),
      onError: (err) => setError(err.message),
    });

    if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
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

  return (
    <div className={styles.draftItem}>
      <div className={styles.draftItemHeader}>
        <span className={styles.draftTitle}>{item.title}</span>
        <span className={clsx(styles.typeBadge, styles[`typeBadge_${item.type}`])}>
          {item.type}
        </span>
      </div>

      <div className={styles.draftMeta}>
        <span
          className={clsx(styles.mediaStatus, item.mediaUrl !== null && styles.mediaStatusReady)}
        >
          {mediaStatus}
        </span>
        <ProcessingIndicator status={item.processingStatus} />
      </div>

      {error && (
        <p className={styles.draftError} role="alert">
          {error}
        </p>
      )}

      <div className={styles.draftActions}>
        <Link
          to="/creators/$creatorId/manage/content/$contentId"
          params={{ creatorId: item.creatorId, contentId: item.id }}
          className={styles.editButton}
        >
          Edit
        </Link>

        {needsMedia && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className={styles.hiddenFileInput}
              accept={item.type === "audio" ? "audio/*" : "video/*"}
              aria-label="Upload media file"
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

        <input
          ref={thumbnailInputRef}
          type="file"
          className={styles.hiddenFileInput}
          accept="image/*"
          aria-label="Upload thumbnail"
          onChange={handleThumbnailChange}
        />
        <button
          type="button"
          className={styles.uploadButton}
          onClick={() => thumbnailInputRef.current?.click()}
          disabled={isPublishing || isDeleting}
        >
          {item.thumbnailUrl ? "Replace Thumbnail" : "Upload Thumbnail"}
        </button>

        <button
          type="button"
          className={styles.publishButton}
          onClick={() => void handlePublish()}
          disabled={!publishEnabled}
        >
          {isPublishing ? "Publishing..." : "Publish"}
        </button>

        <button
          type="button"
          className={styles.deleteButton}
          onClick={() => void handleDelete(item.id)}
          disabled={isPublishing || isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}

// ── Public API ──

/** Paginated list of a creator's unpublished draft content with per-item actions for editing, media/thumbnail upload, publish, and delete. */
export function DraftContentList({
  creatorId,
  refreshKey,
  onPublished,
}: DraftContentListProps): React.ReactElement {
  const { items, nextCursor, isLoading, error, loadMore } =
    useCursorPagination<ContentResponse>({
      buildUrl: (cursor) =>
        buildContentListUrl("/api/content/drafts", { creatorId, cursor }),
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
            onDeleted={onPublished}
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
