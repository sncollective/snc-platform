import { useRef } from "react";
import type React from "react";
import type { FeedItem, SubscriptionPlan, Visibility } from "@snc/shared";

import { VideoPlayer } from "../media/video-player.js";
import { ContentMeta } from "./content-meta.js";
import { EditableContentMeta } from "./editable-content-meta.js";
import { ContentFooter } from "./content-footer.js";
import styles from "./video-detail.module.css";

// ── Public Types ──

export interface VideoDetailEditCallbacks {
  readonly onTitleChange: (value: string) => void;
  readonly onDescriptionChange: (value: string) => void;
  readonly onVisibilityChange: (value: Visibility) => void;
  readonly onMediaUpload?: (file: File) => void;
  readonly onThumbnailUpload?: (file: File) => void;
  readonly onMediaRemove?: () => void;
  readonly onThumbnailRemove?: () => void;
}

export interface VideoDetailProps {
  readonly item: FeedItem;
  readonly locked?: boolean;
  readonly plans?: readonly SubscriptionPlan[];
  readonly isEditing?: boolean;
  readonly editCallbacks?: VideoDetailEditCallbacks;
}

// ── Public API ──

export function VideoDetail({
  item,
  locked,
  plans,
  isEditing,
  editCallbacks,
}: VideoDetailProps): React.ReactElement {
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);

  const handleMediaClick = () => {
    mediaInputRef.current?.click();
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    editCallbacks?.onMediaUpload?.(file);
    e.target.value = "";
  };

  const handleThumbnailClick = () => {
    thumbnailInputRef.current?.click();
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    editCallbacks?.onThumbnailUpload?.(file);
    e.target.value = "";
  };

  const posterSrc = item.thumbnailUrl;

  if (locked === true) {
    return (
      <div className={styles.videoDetail}>
        <div className={styles.lockedOverlayContainer}>
          {posterSrc ? (
            <img
              src={posterSrc}
              alt={`Thumbnail for ${item.title}`}
              className={styles.lockedThumbnail}
            />
          ) : (
            <div className={styles.lockedThumbnailPlaceholder} />
          )}
          <div className={styles.lockedOverlay}>
            <span className={styles.lockIcon} aria-hidden="true">
              &#x1F512;
            </span>
            <span className={styles.lockedText}>Subscribe to watch</span>
          </div>
        </div>
        <div className={styles.meta}>
          <ContentMeta
            title={item.title}
            creatorName={item.creatorName}
            publishedAt={item.publishedAt}
          />
        </div>
        <ContentFooter
          description={item.description}
          creatorId={item.creatorId}
          contentType="video"
          locked
          plans={plans}
        />
      </div>
    );
  }

  if (item.mediaUrl === null) {
    return (
      <div className={styles.videoDetail}>
        {isEditing && editCallbacks?.onMediaUpload ? (
          <div className={`${styles.uploadPlaceholder} ${styles.uploadPlaceholderVideo}`}>
            <button
              type="button"
              className={styles.uploadPlaceholderButton}
              onClick={handleMediaClick}
            >
              Upload Video
            </button>
            <input
              ref={mediaInputRef}
              type="file"
              className={styles.hiddenInput}
              accept="video/*"
              onChange={handleMediaChange}
            />
          </div>
        ) : (
          <div className={styles.mediaUnavailable}>
            <p className={styles.mediaUnavailableText}>Media not yet available</p>
          </div>
        )}
        {isEditing && item.thumbnailUrl !== null && editCallbacks && (
          <div className={styles.editMediaActions}>
            <button type="button" className={styles.replaceButton} onClick={handleThumbnailClick}>
              Replace Thumbnail
            </button>
            <input ref={thumbnailInputRef} type="file" className={styles.hiddenInput} accept="image/*" onChange={handleThumbnailChange} />
            {editCallbacks.onThumbnailRemove && (
              <button type="button" className={styles.removeButton} onClick={editCallbacks.onThumbnailRemove}>
                Remove Thumbnail
              </button>
            )}
          </div>
        )}
        {isEditing && item.thumbnailUrl === null && editCallbacks?.onThumbnailUpload && (
          <div className={styles.uploadPlaceholder}>
            <button
              type="button"
              className={styles.uploadPlaceholderButton}
              onClick={handleThumbnailClick}
            >
              Upload Thumbnail
            </button>
            <input
              ref={thumbnailInputRef}
              type="file"
              className={styles.hiddenInput}
              accept="image/*"
              onChange={handleThumbnailChange}
            />
          </div>
        )}
        <div className={styles.meta}>
          {isEditing && editCallbacks ? (
            <EditableContentMeta
              title={item.title}
              creatorName={item.creatorName}
              publishedAt={item.publishedAt}
              description={item.description}
              visibility={item.visibility}
              isEditing={true}
              onTitleChange={editCallbacks.onTitleChange}
              onDescriptionChange={editCallbacks.onDescriptionChange}
              onVisibilityChange={editCallbacks.onVisibilityChange}
            />
          ) : (
            <ContentMeta
              title={item.title}
              creatorName={item.creatorName}
              publishedAt={item.publishedAt}
            />
          )}
        </div>
        <ContentFooter description={isEditing ? null : item.description} />
      </div>
    );
  }

  const mediaSrc = item.mediaUrl;

  return (
    <div className={styles.videoDetail}>
      <VideoPlayer src={mediaSrc} {...(posterSrc !== null ? { poster: posterSrc } : {})} />
      {isEditing && editCallbacks && (
        <div className={styles.editMediaActions}>
          <button type="button" className={styles.replaceButton} onClick={handleMediaClick}>
            Replace Video
          </button>
          <input ref={mediaInputRef} type="file" className={styles.hiddenInput} accept="video/*" onChange={handleMediaChange} />
          {editCallbacks.onMediaRemove && (
            <button type="button" className={styles.removeButton} onClick={editCallbacks.onMediaRemove}>
              Remove Video
            </button>
          )}
        </div>
      )}
      {isEditing && item.thumbnailUrl !== null && editCallbacks && (
        <div className={styles.editMediaActions}>
          <button type="button" className={styles.replaceButton} onClick={handleThumbnailClick}>
            Replace Thumbnail
          </button>
          <input ref={thumbnailInputRef} type="file" className={styles.hiddenInput} accept="image/*" onChange={handleThumbnailChange} />
          {editCallbacks.onThumbnailRemove && (
            <button type="button" className={styles.removeButton} onClick={editCallbacks.onThumbnailRemove}>
              Remove Thumbnail
            </button>
          )}
        </div>
      )}
      {isEditing && item.thumbnailUrl === null && editCallbacks?.onThumbnailUpload && (
        <div className={styles.uploadPlaceholder}>
          <button
            type="button"
            className={styles.uploadPlaceholderButton}
            onClick={handleThumbnailClick}
          >
            Upload Thumbnail
          </button>
          <input
            ref={thumbnailInputRef}
            type="file"
            className={styles.hiddenInput}
            accept="image/*"
            onChange={handleThumbnailChange}
          />
        </div>
      )}
      <div className={styles.meta}>
        {isEditing && editCallbacks ? (
          <EditableContentMeta
            title={item.title}
            creatorName={item.creatorName}
            publishedAt={item.publishedAt}
            description={item.description}
            visibility={item.visibility}
            isEditing={true}
            onTitleChange={editCallbacks.onTitleChange}
            onDescriptionChange={editCallbacks.onDescriptionChange}
            onVisibilityChange={editCallbacks.onVisibilityChange}
          />
        ) : (
          <ContentMeta
            title={item.title}
            creatorName={item.creatorName}
            publishedAt={item.publishedAt}
          />
        )}
      </div>
      <ContentFooter description={isEditing ? null : item.description} />
    </div>
  );
}
