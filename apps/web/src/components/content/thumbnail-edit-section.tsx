import { useState } from "react";
import type React from "react";

import { useFileInput } from "../../hooks/use-file-input.js";

// ── Public Types ──

export interface ThumbnailEditSectionProps {
  readonly thumbnailSrc: string | null;
  readonly title: string;
  readonly isEditing: boolean;
  readonly onThumbnailUpload?: ((file: File) => void) | undefined;
  readonly onThumbnailRemove?: (() => void) | undefined;
  readonly styles: { readonly [key: string]: string };
  /** Width/height for the <img> element (CLS prevention). */
  readonly imgSize?: { readonly width: number; readonly height: number };
}

// ── Public API ──

/** Render a thumbnail image with optional replace/remove controls in edit mode, an upload placeholder when no thumbnail exists, or a static image/placeholder in read-only mode. */
export function ThumbnailEditSection({
  thumbnailSrc,
  title,
  isEditing,
  onThumbnailUpload,
  onThumbnailRemove,
  styles,
  imgSize,
}: ThumbnailEditSectionProps): React.ReactElement {
  const { inputRef: thumbnailInputRef, triggerSelect: handleClick, handleChange } = useFileInput(onThumbnailUpload);
  const [imgBroken, setImgBroken] = useState(false);

  if (isEditing && thumbnailSrc !== null && !imgBroken) {
    return (
      <div>
        <img
          src={thumbnailSrc}
          alt={`Thumbnail for ${title}`}
          className={styles.coverArt}
          onError={() => setImgBroken(true)}
          {...(imgSize ? { width: imgSize.width, height: imgSize.height } : {})}
        />
        <div className={styles.editMediaActions}>
          <button type="button" className={styles.replaceButton} onClick={handleClick}>
            Replace Thumbnail
          </button>
          <input ref={thumbnailInputRef} type="file" className={styles.hiddenInput} accept="image/*" aria-label="Upload thumbnail image" onChange={handleChange} />
          {onThumbnailRemove && (
            <button type="button" className={styles.removeButton} onClick={onThumbnailRemove}>
              Remove Thumbnail
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isEditing && (thumbnailSrc === null || imgBroken) && onThumbnailUpload) {
    return (
      <div className={styles.uploadPlaceholder}>
        <button
          type="button"
          className={styles.uploadPlaceholderButton}
          onClick={handleClick}
        >
          Upload Thumbnail
        </button>
        <input
          ref={thumbnailInputRef}
          type="file"
          className={styles.hiddenInput}
          accept="image/*"
          aria-label="Upload thumbnail image"
          onChange={handleChange}
        />
      </div>
    );
  }

  if (thumbnailSrc !== null && !imgBroken) {
    return (
      <img
        src={thumbnailSrc}
        alt={`Thumbnail for ${title}`}
        className={styles.coverArt}
        onError={() => setImgBroken(true)}
        {...(imgSize ? { width: imgSize.width, height: imgSize.height } : {})}
      />
    );
  }

  return <div className={styles.coverArtPlaceholder} />;
}
