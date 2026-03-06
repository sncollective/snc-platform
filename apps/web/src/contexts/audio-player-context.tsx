import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type React from "react";
import type { ReactNode } from "react";

// ── Public Types ──

export interface AudioTrack {
  readonly id: string;
  readonly title: string;
  readonly creatorName: string;
  readonly mediaUrl: string;
  readonly coverArtUrl: string | null;
}

export interface AudioPlayerState {
  readonly track: AudioTrack | null;
  readonly isPlaying: boolean;
  readonly currentTime: number;
  readonly duration: number;
}

export interface AudioPlayerActions {
  readonly playTrack: (track: AudioTrack) => void;
  readonly pause: () => void;
  readonly resume: () => void;
  readonly seek: (time: number) => void;
  readonly setVolume: (volume: number) => void;
  readonly clearTrack: () => void;
}

export interface AudioPlayerContextValue {
  readonly state: AudioPlayerState;
  readonly actions: AudioPlayerActions;
}

// ── Constants ──

export const INITIAL_STATE: AudioPlayerState = {
  track: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
};

// ── Reducer ──

type AudioAction =
  | { readonly type: "SET_TRACK"; readonly track: AudioTrack }
  | { readonly type: "PLAY" }
  | { readonly type: "PAUSE" }
  | { readonly type: "SET_PROGRESS"; readonly currentTime: number }
  | { readonly type: "SET_DURATION"; readonly duration: number }
  | { readonly type: "CLEAR" };

export function audioReducer(
  state: AudioPlayerState,
  action: AudioAction,
): AudioPlayerState {
  switch (action.type) {
    case "SET_TRACK":
      return {
        track: action.track,
        isPlaying: true,
        currentTime: 0,
        duration: 0,
      };
    case "PLAY":
      return { ...state, isPlaying: true };
    case "PAUSE":
      return { ...state, isPlaying: false };
    case "SET_PROGRESS":
      return { ...state, currentTime: action.currentTime };
    case "SET_DURATION":
      return { ...state, duration: action.duration };
    case "CLEAR":
      return INITIAL_STATE;
  }
}

// ── Context ──

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

// ── Provider ──

export function AudioPlayerProvider({
  children,
}: Readonly<{ children: ReactNode }>): React.ReactElement {
  const [state, dispatch] = useReducer(audioReducer, INITIAL_STATE);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      dispatch({ type: "SET_PROGRESS", currentTime: audio.currentTime });
    };
    const onLoadedMetadata = () => {
      dispatch({ type: "SET_DURATION", duration: audio.duration });
    };
    const onEnded = () => {
      dispatch({ type: "PAUSE" });
    };
    const onPlay = () => {
      dispatch({ type: "PLAY" });
    };
    const onPause = () => {
      dispatch({ type: "PAUSE" });
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  const actions = useMemo<AudioPlayerActions>(
    () => ({
      playTrack(track: AudioTrack) {
        const audio = audioRef.current;
        if (!audio) return;

        // Lazily create AudioContext + GainNode on first play (requires user gesture)
        if (!audioCtxRef.current && typeof AudioContext !== "undefined") {
          const ctx = new AudioContext();
          const source = ctx.createMediaElementSource(audio);
          const gain = ctx.createGain();
          source.connect(gain);
          gain.connect(ctx.destination);
          audioCtxRef.current = ctx;
          gainRef.current = gain;
          // Element volume stays at 1; GainNode controls output
          audio.volume = 1;
        }

        // Resume AudioContext if suspended (some browsers require this even within a user gesture)
        if (audioCtxRef.current?.state === "suspended") {
          void audioCtxRef.current.resume();
        }

        dispatch({ type: "SET_TRACK", track });
        audio.src = track.mediaUrl;
        audio.play().catch(() => {
          dispatch({ type: "PAUSE" });
        });
      },
      pause() {
        audioRef.current?.pause();
      },
      resume() {
        void audioRef.current?.play();
      },
      seek(time: number) {
        if (audioRef.current) {
          audioRef.current.currentTime = time;
        }
      },
      setVolume(volume: number) {
        const ctx = audioCtxRef.current;
        const gain = gainRef.current;
        if (ctx && gain) {
          gain.gain.cancelScheduledValues(ctx.currentTime);
          gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
        } else if (audioRef.current) {
          audioRef.current.volume = volume;
        }
      },
      clearTrack() {
        const audio = audioRef.current;
        if (!audio) return;
        audio.pause();
        audio.src = "";
        dispatch({ type: "CLEAR" });
      },
    }),
    [],
  );

  const value = useMemo<AudioPlayerContextValue>(
    () => ({ state, actions }),
    [state, actions],
  );

  return (
    <AudioPlayerContext value={value}>
      <audio ref={audioRef} hidden />
      {children}
    </AudioPlayerContext>
  );
}

// ── Hook ──

export function useAudioPlayer(): AudioPlayerContextValue {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error("useAudioPlayer must be used within an AudioPlayerProvider");
  }
  return context;
}
