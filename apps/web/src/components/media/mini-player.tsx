import { useEffect, useState } from "react";
import type React from "react";

import { useAudioPlayer } from "../../contexts/audio-player-context.js";
import { formatTime } from "../../lib/format.js";
import { OptionalImage } from "../ui/optional-image.js";
import styles from "./mini-player.module.css";
import { PlayPauseButton } from "./play-pause-button.js";
import { VolumeControl } from "./volume-control.js";

// ── Constants ──

const MINI_PLAYER_HEIGHT = "56px";

// ── Public API ──

export function MiniPlayer(): React.ReactElement | null {
  const { state, actions } = useAudioPlayer();
  const { track, isPlaying, currentTime, duration } = state;
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    if (track) {
      document.body.style.setProperty("--mini-player-height", MINI_PLAYER_HEIGHT);
    } else {
      document.body.style.setProperty("--mini-player-height", "0px");
    }

    return () => {
      document.body.style.setProperty("--mini-player-height", "0px");
    };
  }, [track]);

  if (!track) {
    return null;
  }

  function handlePlayPause() {
    if (isPlaying) {
      actions.pause();
    } else {
      actions.resume();
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    actions.seek(Number(e.target.value));
  }

  function handleVolumeChange(v: number) {
    setVolume(v);
    actions.setVolume(v);
  }

  function handleClose() {
    actions.clearTrack();
  }

  return (
    <div className={styles.miniPlayer} role="region" aria-label="Audio player">
      {/* Left: Cover art thumbnail */}
      <div className={styles.coverArt}>
        <OptionalImage
          src={track.coverArtUrl}
          alt={`Cover art for ${track.title}`}
          className={styles.coverArtImage!}
          placeholderClassName={styles.coverArtPlaceholder!}
        />
      </div>

      {/* Center: Track info + play/pause */}
      <div className={styles.trackInfo}>
        <span className={styles.trackTitle}>{track.title}</span>
        <span className={styles.trackCreator}>{track.creatorName}</span>
      </div>
      <PlayPauseButton
        isPlaying={isPlaying}
        onClick={handlePlayPause}
        className={styles.playButton!}
      />

      {/* Right: Progress bar + close button (hidden on mobile) */}
      <div className={styles.progressSection}>
        <input
          type="range"
          className={styles.progressBar}
          aria-label="Seek"
          aria-valuetext={formatTime(currentTime)}
          min={0}
          max={duration || 1}
          value={currentTime}
          step={0.1}
          onChange={handleSeek}
        />
        <span className={styles.time}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
      <VolumeControl
        volume={volume}
        onVolumeChange={handleVolumeChange}
        className={styles.volumeSection}
      />
      <button
        type="button"
        className={styles.closeButton}
        aria-label="Close player"
        onClick={handleClose}
      >
        ✕
      </button>
    </div>
  );
}
