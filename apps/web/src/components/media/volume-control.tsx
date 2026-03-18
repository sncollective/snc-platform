import type React from "react";

import styles from "./volume-control.module.css";

// ── Public Types ──

export interface VolumeControlProps {
  readonly volume: number;
  readonly onVolumeChange: (volume: number) => void;
  readonly className?: string | undefined;
}

// ── Public API ──

export function VolumeControl({
  volume,
  onVolumeChange,
  className,
}: VolumeControlProps): React.ReactElement {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onVolumeChange(Number(e.target.value));
  }

  return (
    <div className={className ?? styles.volumeControl}>
      <svg className={styles.volumeIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
      <input
        type="range"
        className={styles.volumeSlider}
        aria-label="Volume"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={handleChange}
      />
    </div>
  );
}
