import { useRef, useState } from "react";
import type React from "react";
import type { ContentResponse } from "@snc/shared";
import { Link } from "@tanstack/react-router";

import { useCursorPagination } from "../../hooks/use-cursor-pagination.js";
import { publishContent, deleteContent } from "../../lib/content.js";
import { useUpload } from "../../contexts/upload-context.js";
import { clsx } from "clsx/lite";

import listingStyles from "../../styles/listing-page.module.css";
import styles from "./draft-content-list.module.css";

// ── Public Types ──

export interface DraftContentListProps {
  readonly creatorId: string;
  readonly creatorHandle: string | null;
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
  readonly creatorHandle: string | null;
  readonly onPublished: () => void;
  readonly onDeleted: () => void;
}

function DraftItem({
  item,
  creatorHandle,
  onPublished,
  onDeleted,
}: DraftItemProps): React.ReactElement {
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);
  const { actions: uploadActions } = useUpload();

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

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this content?")) return;
    setError(null);
    setIsDeleting(true);
    try {
      await deleteContent(item.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
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
      </div>

      {error && (
        <p className={styles.draftError} role="alert">
          {error}
        </p>
      )}

      <div className={styles.draftActions}>
        {item.slug && creatorHandle ? (
          <Link
            to="/content/$creatorSlug/$contentSlug"
            params={{ creatorSlug: creatorHandle, contentSlug: item.slug }}
            search={{ edit: true }}
            className={styles.editButton}
          >
            Edit
          </Link>
        ) : (
          <Link
            to="/content/$contentId"
            params={{ contentId: item.id }}
            search={{ edit: true }}
            className={styles.editButton}
          >
            Edit
          </Link>
        )}

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

        <a
          href={
            item.slug && creatorHandle
              ? `/content/${creatorHandle}/${item.slug}`
              : `/content/${item.id}`
          }
          className={styles.previewLink}
          target="_blank"
          rel="noreferrer"
        >
          Preview
        </a>

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
          onClick={() => void handleDelete()}
          disabled={isPublishing || isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}

// ── Public API ──

/** Paginated list of a creator's unpublished draft content with per-item actions for editing, media/thumbnail upload, preview, publish, and delete. */
export function DraftContentList({
  creatorId,
  creatorHandle,
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
            creatorHandle={creatorHandle}
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
