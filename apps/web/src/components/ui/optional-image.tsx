import type React from "react";

// ── Public Types ──

export interface OptionalImageProps {
  readonly src: string | null | undefined;
  readonly alt: string;
  readonly className: string;
  readonly placeholderClassName: string;
  readonly loading?: "lazy" | "eager";
  readonly width?: number;
  readonly height?: number;
  /** Width-descriptor or DPR-descriptor srcSet string. */
  readonly srcSet?: string | null;
  /** Sizes attribute for width-descriptor srcSet. */
  readonly sizes?: string | null;
}

// ── Public API ──

/**
 * Render an `<img>` when a src URL is provided, or a styled placeholder
 * `<div>` when src is null/undefined.
 *
 * When `srcSet` and `sizes` are provided, the browser selects the best
 * image variant. `src` is the fallback for browsers without srcSet support.
 */
export function OptionalImage({
  src,
  alt,
  className,
  placeholderClassName,
  loading,
  width,
  height,
  srcSet,
  sizes,
}: OptionalImageProps): React.ReactElement {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        decoding="async"
        width={width}
        height={height}
        {...(srcSet ? { srcSet } : {})}
        {...(sizes ? { sizes } : {})}
      />
    );
  }

  return <div className={placeholderClassName} />;
}
