import { useEffect, useRef, useState } from "react";
import type React from "react";

import type { AudioTrack } from "../../contexts/audio-player-context.js";
import { useAudioPlayer } from "../../contexts/audio-player-context.js";
import { formatTime } from "../../lib/format.js";
import styles from "./audio-player.module.css";

// ── Public Types ──

export interface AudioPlayerProps {
  readonly src: string;
  readonly title: string;
  readonly creator: string;
  readonly coverArtUrl?: string;
  readonly contentId: string;
}

// ── Public API ──

export function AudioPlayer({
  src,
  title,
  creator,
  coverArtUrl,
  contentId,
}: AudioPlayerProps): React.ReactElement {
  const { state, actions } = useAudioPlayer();
  const [volume, setVolume] = useState(1);
  const [preloadedDuration, setPreloadedDuration] = useState(0);
  const preloadRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = preloadRef.current;
    if (!audio) return;
    const onMeta = () => {
      if (Number.isFinite(audio.duration)) {
        setPreloadedDuration(audio.duration);
      }
    };
    audio.addEventListener("loadedmetadata", onMeta);
    return () => audio.removeEventListener("loadedmetadata", onMeta);
  }, []);

  const isThisTrack = state.track?.id === contentId;
  const isPlaying = isThisTrack && state.isPlaying;
  const currentTime = isThisTrack ? state.currentTime : 0;
  const duration = isThisTrack ? state.duration : preloadedDuration;

  function handlePlayPause() {
    if (!isThisTrack) {
      const track: AudioTrack = {
        id: contentId,
        title,
        creatorName: creator,
        mediaUrl: src,
        coverArtUrl: coverArtUrl ?? null,
      };
      actions.playTrack(track);
    } else if (isPlaying) {
      actions.pause();
    } else {
      actions.resume();
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    actions.seek(Number(e.target.value));
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    actions.setVolume(newVolume);
  }

  return (
    <div className={styles.player}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={preloadRef} src={src} preload="metadata" hidden />
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.playButton}
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={handlePlayPause}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <input
          type="range"
          className={styles.progressBar}
          aria-label="Seek"
          aria-valuetext={formatTime(currentTime)}
          min={0}
          max={isThisTrack ? duration : 1}
          value={isThisTrack ? currentTime : 0}
          step={0.1}
          disabled={!isThisTrack}
          onChange={handleSeek}
        />
        <span className={styles.time}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
      <div className={styles.volumeRow}>
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
          onChange={handleVolumeChange}
        />
      </div>
    </div>
  );
}
