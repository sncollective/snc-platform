import type React from "react";

// ── Public Types ──

export interface OptionalImageProps {
  readonly src: string | null | undefined;
  readonly alt: string;
  readonly className: string;
  readonly placeholderClassName: string;
  readonly loading?: "lazy" | "eager";
}

// ── Public API ──

export function OptionalImage({
  src,
  alt,
  className,
  placeholderClassName,
  loading,
}: OptionalImageProps): React.ReactElement {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
      />
    );
  }

  return <div className={placeholderClassName} />;
}
