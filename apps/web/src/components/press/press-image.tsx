import type React from "react";

import type { PressImageProps } from "./press-types.js";
import styles from "./press-image.module.css";

const SLOT_DIMENSIONS = {
  banner: { width: 1500, height: 500 },
  about: { width: 720, height: 900 },
  member: { width: 480, height: 480 },
  gallery: { width: 960, height: 720 },
  cover: { width: 480, height: 480 },
} as const;

/** Render delivered press media with intrinsic dimensions and optional credit. */
export function PressImageFigure({
  image,
  slot,
  creditMode = "caption",
  loading = "lazy",
  fetchPriority = "auto",
  className,
}: PressImageProps): React.ReactElement | null {
  if (!image) return null;

  const dimensions = SLOT_DIMENSIONS[slot];
  const figureClassName = [
    styles.figure,
    styles[slot],
    creditMode === "overlay" ? styles.overlay : "",
    className ?? "",
  ].filter(Boolean).join(" ");

  return (
    <figure className={figureClassName}>
      <img
        src={image.src}
        srcSet={image.srcSet}
        sizes={image.sizes}
        alt={image.alt}
        width={dimensions.width}
        height={dimensions.height}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
      />
      {image.credit && <figcaption>{image.credit}</figcaption>}
    </figure>
  );
}
