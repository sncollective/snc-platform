import type React from "react";

// ── Public Types ──

export interface PlayPauseButtonProps {
  readonly isPlaying: boolean;
  readonly onClick: () => void;
  readonly className: string;
}

// ── Public API ──

export function PlayPauseButton({
  isPlaying,
  onClick,
  className,
}: PlayPauseButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      className={className}
      aria-label={isPlaying ? "Pause" : "Play"}
      onClick={onClick}
    >
      {isPlaying ? "\u23F8" : "\u25B6"}
    </button>
  );
}
