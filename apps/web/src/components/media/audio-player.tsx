import { useEffect, useRef, useState } from "react";
import type React from "react";

import type { AudioTrack } from "../../contexts/audio-player-context.js";
import { useAudioPlayer } from "../../contexts/audio-player-context.js";
import { useMediaControls } from "../../hooks/use-media-controls.js";
import { formatTime } from "../../lib/format.js";
import styles from "./audio-player.module.css";
import { PlayPauseButton } from "./play-pause-button.js";
import { VolumeControl } from "./volume-control.js";

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
  const { volume, handleSeek, handleVolumeChange } = useMediaControls(actions);
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

  return (
    <div className={styles.player}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={preloadRef} src={src} preload="metadata" hidden />
      <div className={styles.controls}>
        <PlayPauseButton
          isPlaying={isPlaying}
          onClick={handlePlayPause}
          className={styles.playButton!}
        />
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
      <VolumeControl
        volume={volume}
        onVolumeChange={handleVolumeChange}
        className={styles.volumeRow}
      />
    </div>
  );
}
