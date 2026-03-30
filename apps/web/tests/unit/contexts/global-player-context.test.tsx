import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";

import {
  GlobalPlayerProvider,
  globalPlayerReducer,
  useGlobalPlayer,
  INITIAL_STATE,
} from "../../../src/contexts/global-player-context.js";
import type { MediaMetadata } from "../../../src/contexts/global-player-context.js";

// ── Fixtures ──

const AUDIO_MEDIA: MediaMetadata = {
  id: "track-1",
  contentType: "audio",
  title: "Test Song",
  artist: "Test Artist",
  posterUrl: "/cover.jpg",
  source: { src: "/api/content/track-1/media", type: "audio/mpeg" },
  streamType: "on-demand",
  contentUrl: "/content/track-1",
};

const VIDEO_MEDIA: MediaMetadata = {
  id: "video-1",
  contentType: "video",
  title: "Test Video",
  artist: "Test Creator",
  posterUrl: null,
  source: { src: "/api/content/video-1/media", type: "video/mp4" },
  streamType: "on-demand",
  contentUrl: "/content/video-1",
};

// ── Helpers ──

function wrapper({ children }: Readonly<{ children: ReactNode }>): React.ReactElement {
  return <GlobalPlayerProvider>{children}</GlobalPlayerProvider>;
}

// ── Reducer Tests ──

describe("globalPlayerReducer", () => {
  it("PLAY sets media", () => {
    const next = globalPlayerReducer(INITIAL_STATE, { type: "PLAY", media: AUDIO_MEDIA });
    expect(next.media).toEqual(AUDIO_MEDIA);
    expect(next.activeDetailId).toBeNull();
  });

  it("PLAY sets shouldAutoPlay to true", () => {
    const next = globalPlayerReducer(INITIAL_STATE, { type: "PLAY", media: AUDIO_MEDIA });
    expect(next.shouldAutoPlay).toBe(true);
  });

  it("PLAY replaces existing media", () => {
    const withAudio = globalPlayerReducer(INITIAL_STATE, { type: "PLAY", media: AUDIO_MEDIA });
    const next = globalPlayerReducer(withAudio, { type: "PLAY", media: VIDEO_MEDIA });
    expect(next.media).toEqual(VIDEO_MEDIA);
  });

  it("CLEAR resets to initial state", () => {
    const withMedia = globalPlayerReducer(INITIAL_STATE, { type: "PLAY", media: AUDIO_MEDIA });
    const next = globalPlayerReducer(withMedia, { type: "CLEAR" });
    expect(next).toEqual(INITIAL_STATE);
  });

  it("CLEAR resets shouldAutoPlay to false", () => {
    const withPlay = globalPlayerReducer(INITIAL_STATE, { type: "PLAY", media: AUDIO_MEDIA });
    expect(withPlay.shouldAutoPlay).toBe(true);
    const next = globalPlayerReducer(withPlay, { type: "CLEAR" });
    expect(next.shouldAutoPlay).toBe(false);
  });

  it("SET_ACTIVE_DETAIL sets activeDetailId without changing shouldAutoPlay", () => {
    const withPlay = globalPlayerReducer(INITIAL_STATE, { type: "PLAY", media: AUDIO_MEDIA });
    const next = globalPlayerReducer(withPlay, { type: "SET_ACTIVE_DETAIL", id: "track-1" });
    expect(next.activeDetailId).toBe("track-1");
    expect(next.shouldAutoPlay).toBe(true);
  });

  it("SET_ACTIVE_DETAIL sets activeDetailId", () => {
    const next = globalPlayerReducer(INITIAL_STATE, { type: "SET_ACTIVE_DETAIL", id: "track-1" });
    expect(next.activeDetailId).toBe("track-1");
    expect(next.media).toBeNull();
  });

  it("SET_ACTIVE_DETAIL accepts null", () => {
    const withDetail = globalPlayerReducer(INITIAL_STATE, { type: "SET_ACTIVE_DETAIL", id: "track-1" });
    const next = globalPlayerReducer(withDetail, { type: "SET_ACTIVE_DETAIL", id: null });
    expect(next.activeDetailId).toBeNull();
  });
});

// ── Provider Tests ──

describe("GlobalPlayerProvider", () => {
  it("provides hidden presentation when no media", () => {
    const { result } = renderHook(() => useGlobalPlayer(), { wrapper });
    expect(result.current.presentation).toBe("hidden");
    expect(result.current.state.media).toBeNull();
  });

  it("shouldAutoPlay is false initially", () => {
    const { result } = renderHook(() => useGlobalPlayer(), { wrapper });
    expect(result.current.state.shouldAutoPlay).toBe(false);
  });

  it("shouldAutoPlay is true after play()", () => {
    const { result } = renderHook(() => useGlobalPlayer(), { wrapper });
    act(() => {
      result.current.actions.play(AUDIO_MEDIA);
    });
    expect(result.current.state.shouldAutoPlay).toBe(true);
  });

  it("shouldAutoPlay is false after clear()", () => {
    const { result } = renderHook(() => useGlobalPlayer(), { wrapper });
    act(() => {
      result.current.actions.play(AUDIO_MEDIA);
    });
    act(() => {
      result.current.actions.clear();
    });
    expect(result.current.state.shouldAutoPlay).toBe(false);
  });

  it("provides collapsed presentation when media loaded but no activeDetailId match", () => {
    const { result } = renderHook(() => useGlobalPlayer(), { wrapper });
    act(() => {
      result.current.actions.play(AUDIO_MEDIA);
    });
    expect(result.current.presentation).toBe("collapsed");
  });

  it("provides expanded presentation when activeDetailId matches media.id", () => {
    const { result } = renderHook(() => useGlobalPlayer(), { wrapper });
    act(() => {
      result.current.actions.play(AUDIO_MEDIA);
    });
    act(() => {
      result.current.actions.setActiveDetail(AUDIO_MEDIA.id);
    });
    expect(result.current.presentation).toBe("expanded");
  });

  it("play() sets media", () => {
    const { result } = renderHook(() => useGlobalPlayer(), { wrapper });
    act(() => {
      result.current.actions.play(AUDIO_MEDIA);
    });
    expect(result.current.state.media).toEqual(AUDIO_MEDIA);
  });

  it("play() skips dispatch when media.id matches current", () => {
    const { result } = renderHook(() => useGlobalPlayer(), { wrapper });
    act(() => {
      result.current.actions.play(AUDIO_MEDIA);
    });
    const mediaAfterFirst = result.current.state.media;
    act(() => {
      // Same id — should be a no-op
      result.current.actions.play({ ...AUDIO_MEDIA, title: "Different Title" });
    });
    // Reference equality confirms no new dispatch occurred
    expect(result.current.state.media).toBe(mediaAfterFirst);
  });

  it("clear() resets to null media and activeDetailId", () => {
    const { result } = renderHook(() => useGlobalPlayer(), { wrapper });
    act(() => {
      result.current.actions.play(AUDIO_MEDIA);
      result.current.actions.setActiveDetail(AUDIO_MEDIA.id);
    });
    act(() => {
      result.current.actions.clear();
    });
    expect(result.current.state.media).toBeNull();
    expect(result.current.state.activeDetailId).toBeNull();
    expect(result.current.presentation).toBe("hidden");
  });

  it("setActiveDetail() updates activeDetailId", () => {
    const { result } = renderHook(() => useGlobalPlayer(), { wrapper });
    act(() => {
      result.current.actions.setActiveDetail("some-id");
    });
    expect(result.current.state.activeDetailId).toBe("some-id");
  });
});

// ── Hook Guard ──

describe("useGlobalPlayer", () => {
  it("throws outside provider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useGlobalPlayer())).toThrow(
      "useGlobalPlayer must be used within a GlobalPlayerProvider",
    );
    consoleSpy.mockRestore();
  });
});

// ── Live Layout Reducer Tests ──

describe("globalPlayerReducer — live layout", () => {
  it("SET_LIVE_LAYOUT sets liveLayout", () => {
    const next = globalPlayerReducer(INITIAL_STATE, {
      type: "SET_LIVE_LAYOUT",
      layout: "theater",
    });
    expect(next.liveLayout).toBe("theater");
  });

  it("SET_LIVE_LAYOUT null clears liveLayout", () => {
    const state = { ...INITIAL_STATE, liveLayout: "default" as const };
    const next = globalPlayerReducer(state, {
      type: "SET_LIVE_LAYOUT",
      layout: null,
    });
    expect(next.liveLayout).toBeNull();
  });

  it("SET_CHAT_COLLAPSED sets chatCollapsed", () => {
    const next = globalPlayerReducer(INITIAL_STATE, {
      type: "SET_CHAT_COLLAPSED",
      collapsed: true,
    });
    expect(next.chatCollapsed).toBe(true);
  });

  it("CLEAR resets liveLayout and chatCollapsed", () => {
    const state = {
      ...INITIAL_STATE,
      media: AUDIO_MEDIA,
      liveLayout: "theater" as const,
      chatCollapsed: true,
    };
    const next = globalPlayerReducer(state, { type: "CLEAR" });
    expect(next.liveLayout).toBeNull();
    expect(next.chatCollapsed).toBe(false);
  });
});

// ── Live Layout Provider Tests ──

describe("GlobalPlayerProvider — live layout", () => {
  it("setLiveLayout updates state", () => {
    const { result } = renderHook(() => useGlobalPlayer(), { wrapper });
    act(() => {
      result.current.actions.setLiveLayout("theater");
    });
    expect(result.current.state.liveLayout).toBe("theater");
  });

  it("chatPortalRef is available", () => {
    const { result } = renderHook(() => useGlobalPlayer(), { wrapper });
    expect(result.current.chatPortalRef).toBeDefined();
    expect(result.current.chatPortalRef.current).toBeNull();
  });
});
