import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";

import {
  AudioPlayerProvider,
  useAudioPlayer,
  audioReducer,
  INITIAL_STATE,
} from "../../../src/contexts/audio-player-context.js";
import type {
  AudioTrack,
  AudioPlayerState,
} from "../../../src/contexts/audio-player-context.js";

// ── Constants ──

const TEST_TRACK: AudioTrack = {
  id: "track-1",
  title: "Test Song",
  creatorName: "Test Artist",
  mediaUrl: "/api/content/track-1/media",
  coverArtUrl: "/api/content/track-1/cover-art",
};

// ── Test Lifecycle ──

beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.pause = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function wrapper({ children }: Readonly<{ children: ReactNode }>): React.ReactElement {
  return <AudioPlayerProvider>{children}</AudioPlayerProvider>;
}

// ── Tests ──

describe("audioReducer", () => {
  it("SET_TRACK sets track, isPlaying true, resets time", () => {
    const result = audioReducer(INITIAL_STATE, { type: "SET_TRACK", track: TEST_TRACK });
    expect(result).toEqual({
      track: TEST_TRACK,
      isPlaying: true,
      currentTime: 0,
      duration: 0,
    });
  });

  it("PLAY sets isPlaying to true", () => {
    const state: AudioPlayerState = { ...INITIAL_STATE, track: TEST_TRACK, isPlaying: false };
    const result = audioReducer(state, { type: "PLAY" });
    expect(result.isPlaying).toBe(true);
  });

  it("PAUSE sets isPlaying to false", () => {
    const state: AudioPlayerState = { ...INITIAL_STATE, track: TEST_TRACK, isPlaying: true };
    const result = audioReducer(state, { type: "PAUSE" });
    expect(result.isPlaying).toBe(false);
  });

  it("SET_PROGRESS updates currentTime", () => {
    const state: AudioPlayerState = { ...INITIAL_STATE, track: TEST_TRACK, isPlaying: true };
    const result = audioReducer(state, { type: "SET_PROGRESS", currentTime: 42.5 });
    expect(result.currentTime).toBe(42.5);
  });

  it("SET_DURATION updates duration", () => {
    const state: AudioPlayerState = { ...INITIAL_STATE, track: TEST_TRACK };
    const result = audioReducer(state, { type: "SET_DURATION", duration: 180 });
    expect(result.duration).toBe(180);
  });

  it("CLEAR resets to INITIAL_STATE", () => {
    const state: AudioPlayerState = {
      track: TEST_TRACK,
      isPlaying: true,
      currentTime: 42.5,
      duration: 180,
    };
    const result = audioReducer(state, { type: "CLEAR" });
    expect(result).toEqual(INITIAL_STATE);
  });
});

describe("AudioPlayerProvider + useAudioPlayer", () => {
  it("provides initial state", () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    expect(result.current.state).toEqual(INITIAL_STATE);
  });

  it("playTrack sets track and starts playback", () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    act(() => {
      result.current.actions.playTrack(TEST_TRACK);
    });
    expect(result.current.state.track).toEqual(TEST_TRACK);
    expect(result.current.state.isPlaying).toBe(true);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it("pause stops playback without clearing track", () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    act(() => {
      result.current.actions.playTrack(TEST_TRACK);
    });
    act(() => {
      result.current.actions.pause();
    });
    const audio = document.querySelector("audio")!;
    act(() => {
      audio.dispatchEvent(new Event("pause"));
    });
    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.state.track).toEqual(TEST_TRACK);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it("resume restarts playback", () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    act(() => {
      result.current.actions.playTrack(TEST_TRACK);
    });
    act(() => {
      result.current.actions.pause();
    });
    act(() => {
      result.current.actions.resume();
    });
    const audio = document.querySelector("audio")!;
    act(() => {
      audio.dispatchEvent(new Event("play"));
    });
    expect(result.current.state.isPlaying).toBe(true);
    // play() called twice: once for playTrack, once for resume
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  });

  it("seek sets audio currentTime", () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    act(() => {
      result.current.actions.playTrack(TEST_TRACK);
    });
    act(() => {
      result.current.actions.seek(30);
    });
    const audio = document.querySelector("audio")!;
    expect(audio.currentTime).toBe(30);
  });

  it("setVolume adjusts volume on the audio element", () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    act(() => {
      result.current.actions.playTrack(TEST_TRACK);
    });
    act(() => {
      result.current.actions.setVolume(0.5);
    });
    const audio = document.querySelector("audio")!;
    // jsdom has no Web Audio API, so the fallback sets audio.volume directly
    expect(audio.volume).toBe(0.5);
  });

  it("clearTrack resets all state", () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    act(() => {
      result.current.actions.playTrack(TEST_TRACK);
    });
    act(() => {
      result.current.actions.clearTrack();
    });
    expect(result.current.state).toEqual(INITIAL_STATE);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    const audio = document.querySelector("audio")!;
    // jsdom resolves audio.src to the base URL when set to ""; check the raw attribute
    expect(audio.getAttribute("src")).toBe("");
  });

  it("syncs currentTime from timeupdate event", () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    act(() => {
      result.current.actions.playTrack(TEST_TRACK);
    });
    const audio = document.querySelector("audio")!;
    Object.defineProperty(audio, "currentTime", {
      value: 15.5,
      writable: true,
      configurable: true,
    });
    act(() => {
      audio.dispatchEvent(new Event("timeupdate"));
    });
    expect(result.current.state.currentTime).toBe(15.5);
  });

  it("syncs duration from loadedmetadata event", () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    act(() => {
      result.current.actions.playTrack(TEST_TRACK);
    });
    const audio = document.querySelector("audio")!;
    Object.defineProperty(audio, "duration", {
      value: 240,
      writable: true,
      configurable: true,
    });
    act(() => {
      audio.dispatchEvent(new Event("loadedmetadata"));
    });
    expect(result.current.state.duration).toBe(240);
  });

  it("reverts isPlaying when play() rejects", async () => {
    HTMLMediaElement.prototype.play = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => {
      result.current.actions.playTrack(TEST_TRACK);
    });
    expect(result.current.state.track).toEqual(TEST_TRACK);
    expect(result.current.state.isPlaying).toBe(false);
  });

  it("sets isPlaying false on ended event", () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    act(() => {
      result.current.actions.playTrack(TEST_TRACK);
    });
    const audio = document.querySelector("audio")!;
    act(() => {
      audio.dispatchEvent(new Event("ended"));
    });
    expect(result.current.state.isPlaying).toBe(false);
  });
});

describe("useAudioPlayer outside provider", () => {
  it("throws when used outside AudioPlayerProvider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAudioPlayer())).toThrow(
      "useAudioPlayer must be used within an AudioPlayerProvider",
    );
    consoleSpy.mockRestore();
  });
});
