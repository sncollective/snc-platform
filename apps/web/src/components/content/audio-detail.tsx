import { useRef } from "react";
import type React from "react";
import type { FeedItem, SubscriptionPlan, Visibility } from "@snc/shared";

import { AudioPlayer } from "../media/audio-player.js";
import { ContentMeta } from "./content-meta.js";
import { EditableContentMeta } from "./editable-content-meta.js";
import { ContentFooter } from "./content-footer.js";
import styles from "./audio-detail.module.css";

// ── Public Types ──

export interface AudioDetailEditCallbacks {
  readonly onTitleChange: (value: string) => void;
  readonly onDescriptionChange: (value: string) => void;
  readonly onVisibilityChange: (value: Visibility) => void;
  readonly onMediaUpload?: (file: File) => void;
  readonly onThumbnailUpload?: (file: File) => void;
  readonly onMediaRemove?: () => void;
  readonly onThumbnailRemove?: () => void;
}

export interface AudioDetailProps {
  readonly item: FeedItem;
  readonly locked?: boolean;
  readonly plans?: readonly SubscriptionPlan[];
  readonly isEditing?: boolean;
  readonly editCallbacks?: AudioDetailEditCallbacks;
}

// ── Public API ──

export function AudioDetail({
  item,
  locked,
  plans,
  isEditing,
  editCallbacks,
}: AudioDetailProps): React.ReactElement {
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

  const coverArtSrc = item.thumbnailUrl;

  if (locked === true) {
    return (
      <div className={styles.audioDetail}>
        <div className={styles.header}>
          {coverArtSrc ? (
            <img
              src={coverArtSrc}
              alt={`Thumbnail for ${item.title}`}
              className={styles.coverArt}
            />
          ) : (
            <div className={styles.coverArtPlaceholder} />
          )}
          <div className={styles.trackInfo}>
            <ContentMeta
              title={item.title}
              creatorName={item.creatorName}
              publishedAt={item.publishedAt}
            />
            <p className={styles.lockedText}>Subscribe to listen</p>
          </div>
        </div>
        <ContentFooter
          description={item.description}
          creatorId={item.creatorId}
          contentType="audio"
          locked
          plans={plans}
        />
      </div>
    );
  }

  if (item.mediaUrl === null) {
    return (
      <div className={styles.audioDetail}>
        <div className={styles.header}>
          {isEditing && coverArtSrc !== null && editCallbacks ? (
            <div>
              <img
                src={coverArtSrc}
                alt={`Thumbnail for ${item.title}`}
                className={styles.coverArt}
              />
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
            </div>
          ) : isEditing && coverArtSrc === null && editCallbacks?.onThumbnailUpload ? (
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
          ) : coverArtSrc !== null ? (
            <img className={styles.coverArt} src={coverArtSrc} alt={`Thumbnail for ${item.title}`} />
          ) : (
            <div className={styles.coverArtPlaceholder} />
          )}
          <div className={styles.trackInfo}>
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
            {isEditing && editCallbacks?.onMediaUpload ? (
              <div className={styles.uploadPlaceholder}>
                <button
                  type="button"
                  className={styles.uploadPlaceholderButton}
                  onClick={handleMediaClick}
                >
                  Upload Audio
                </button>
                <input
                  ref={mediaInputRef}
                  type="file"
                  className={styles.hiddenInput}
                  accept="audio/*"
                  onChange={handleMediaChange}
                />
              </div>
            ) : (
              <p className={styles.mediaUnavailableText}>Media not yet available</p>
            )}
          </div>
        </div>
        <ContentFooter description={isEditing ? null : item.description} />
      </div>
    );
  }

  const mediaSrc = item.mediaUrl;

  return (
    <div className={styles.audioDetail}>
      <div className={styles.header}>
        {isEditing && coverArtSrc !== null && editCallbacks ? (
          <div>
            <img
              src={coverArtSrc}
              alt={`Thumbnail for ${item.title}`}
              className={styles.coverArt}
            />
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
          </div>
        ) : isEditing && coverArtSrc === null && editCallbacks?.onThumbnailUpload ? (
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
        ) : coverArtSrc ? (
          <img
            src={coverArtSrc}
            alt={`Thumbnail for ${item.title}`}
            className={styles.coverArt}
          />
        ) : (
          <div className={styles.coverArtPlaceholder} />
        )}
        <div className={styles.trackInfo}>
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
          <div className={styles.playerWrapper}>
            <AudioPlayer
              src={mediaSrc}
              title={item.title}
              creator={item.creatorName}
              {...(coverArtSrc !== null ? { coverArtUrl: coverArtSrc } : {})}
              contentId={item.id}
            />
          </div>
          {isEditing && editCallbacks && (
            <div className={styles.editMediaActions}>
              <button type="button" className={styles.replaceButton} onClick={handleMediaClick}>
                Replace Audio
              </button>
              <input ref={mediaInputRef} type="file" className={styles.hiddenInput} accept="audio/*" onChange={handleMediaChange} />
              {editCallbacks.onMediaRemove && (
                <button type="button" className={styles.removeButton} onClick={editCallbacks.onMediaRemove}>
                  Remove Audio
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <ContentFooter description={isEditing ? null : item.description} />
    </div>
  );
}
