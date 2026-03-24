import { useState } from "react";
import type React from "react";

import type { AudioPlayerActions } from "../contexts/audio-player-context.js";

// ── Public Types ──

export interface UseMediaControlsReturn {
  readonly volume: number;
  readonly handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readonly handleVolumeChange: (newVolume: number) => void;
}

// ── Public API ──

/** Manage seek and volume controls for the audio player. */
export function useMediaControls(actions: AudioPlayerActions): UseMediaControlsReturn {
  const [volume, setVolume] = useState(1);

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    actions.seek(Number(e.target.value));
  }

  function handleVolumeChange(newVolume: number) {
    setVolume(newVolume);
    actions.setVolume(newVolume);
  }

  return { volume, handleSeek, handleVolumeChange };
}
