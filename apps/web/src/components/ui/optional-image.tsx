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
}

// ── Public API ──

/** Render an `<img>` when a src URL is provided, or a styled placeholder `<div>` when src is null/undefined. */
export function OptionalImage({
  src,
  alt,
  className,
  placeholderClassName,
  loading,
  width,
  height,
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
      />
    );
  }

  return <div className={placeholderClassName} />;
}
