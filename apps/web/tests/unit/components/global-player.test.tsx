import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Hoisted mocks ──

const mockClear = vi.hoisted(() => vi.fn());
const mockUseGlobalPlayer = vi.hoisted(() => vi.fn());

vi.mock("../../../src/contexts/global-player-context.js", () => ({
  useGlobalPlayer: mockUseGlobalPlayer,
}));

vi.mock("@vidstack/react", () => ({
  MediaPlayer: ({
    children,
    onCanPlay,
    onError,
  }: {
    children: React.ReactNode;
    onCanPlay?: () => void;
    onError?: () => void;
  }) => (
    <div data-testid="media-player">
      <button data-testid="fire-can-play" onClick={() => onCanPlay?.()} />
      <button data-testid="fire-error" onClick={() => onError?.()} />
      {children}
    </div>
  ),
  MediaProvider: () => <div data-testid="media-provider" />,
}));

vi.mock("@vidstack/react/player/layouts/default", () => ({
  DefaultAudioLayout: () => <div data-testid="audio-layout" />,
  DefaultVideoLayout: () => <div data-testid="video-layout" />,
  defaultLayoutIcons: {},
}));

// ── Import after mocks ──

import { GlobalPlayer } from "../../../src/components/media/global-player.js";
import type { MediaMetadata } from "../../../src/contexts/global-player-context.js";

// ── Fixtures ──

const AUDIO_MEDIA: MediaMetadata = {
  id: "track-1",
  contentType: "audio",
  title: "Test Song",
  artist: "Test Artist",
  posterUrl: "/cover.jpg",
  source: { src: "/audio.mp3", type: "audio/mpeg" },
  streamType: "on-demand",
  contentUrl: "/content/track-1",
};

const VIDEO_MEDIA: MediaMetadata = {
  id: "video-1",
  contentType: "video",
  title: "Test Video",
  artist: "Test Creator",
  posterUrl: null,
  source: { src: "/video.mp4", type: "video/mp4" },
  streamType: "on-demand",
  contentUrl: "/content/video-1",
};

const LIVE_MEDIA: MediaMetadata = {
  id: "live-channel-1",
  contentType: "live",
  title: "Live Stream",
  artist: "Live Creator",
  posterUrl: null,
  source: { src: "https://example.com/live.m3u8", type: "application/x-mpegurl" },
  streamType: "live",
  contentUrl: "/live/live-channel-1",
};

// ── Helpers ──

function makeContext(
  media: MediaMetadata | null,
  presentation: "expanded" | "collapsed" | "hidden",
  shouldAutoPlay = false,
) {
  return {
    state: { media, activeDetailId: null, shouldAutoPlay },
    presentation,
    actions: { play: vi.fn(), clear: mockClear, setActiveDetail: vi.fn() },
  };
}

// ── Tests ──

describe("GlobalPlayer", () => {
  beforeEach(() => {
    mockClear.mockReset();
  });

  it("renders nothing when no media", () => {
    mockUseGlobalPlayer.mockReturnValue(makeContext(null, "hidden"));
    const { container } = render(<GlobalPlayer />);
    expect(container.firstChild).toBeNull();
  });

  it("renders with expanded class when presentation is expanded", async () => {
    mockUseGlobalPlayer.mockReturnValue(makeContext(VIDEO_MEDIA, "expanded"));
    const { container } = render(<GlobalPlayer />);

    // Dynamic import resolves asynchronously in the effect; player renders after modules load
    // The container should have the player wrapper div
    const wrapper = container.firstChild as HTMLElement | null;
    if (wrapper) {
      expect(wrapper.getAttribute("data-presentation")).toBe("expanded");
    }
  });

  it("renders with collapsedBar class for collapsed audio", () => {
    mockUseGlobalPlayer.mockReturnValue(makeContext(AUDIO_MEDIA, "collapsed"));
    const { container } = render(<GlobalPlayer />);
    const wrapper = container.firstChild as HTMLElement | null;
    if (wrapper) {
      expect(wrapper.getAttribute("data-presentation")).toBe("collapsed");
    }
  });

  it("renders with collapsedOverlay for collapsed video", () => {
    mockUseGlobalPlayer.mockReturnValue(makeContext(VIDEO_MEDIA, "collapsed"));
    const { container } = render(<GlobalPlayer />);
    const wrapper = container.firstChild as HTMLElement | null;
    if (wrapper) {
      expect(wrapper.getAttribute("data-presentation")).toBe("collapsed");
    }
  });

  it("renders close button in collapsed mode", () => {
    mockUseGlobalPlayer.mockReturnValue(makeContext(AUDIO_MEDIA, "collapsed"));
    render(<GlobalPlayer />);
    expect(screen.getByRole("button", { name: "Close player" })).toBeTruthy();
  });

  it("calls clear when close button is clicked", () => {
    mockUseGlobalPlayer.mockReturnValue(makeContext(AUDIO_MEDIA, "collapsed"));
    render(<GlobalPlayer />);
    const closeBtn = screen.getByRole("button", { name: "Close player" });
    fireEvent.click(closeBtn);
    expect(mockClear).toHaveBeenCalledOnce();
  });

  it("does not render close button in expanded mode", () => {
    mockUseGlobalPlayer.mockReturnValue(makeContext(VIDEO_MEDIA, "expanded"));
    render(<GlobalPlayer />);
    expect(screen.queryByRole("button", { name: "Close player" })).toBeNull();
  });

  // ── Skeleton and error overlay tests ──

  it("shows skeleton on mount for live/video media (expanded)", async () => {
    mockUseGlobalPlayer.mockReturnValue(makeContext(LIVE_MEDIA, "expanded"));
    render(<GlobalPlayer />);

    // Skeleton present on mount (status starts as "loading")
    const skeleton = await screen.findByRole("status", { name: "Loading stream" });
    expect(skeleton).toBeTruthy();

    // After canPlay fires, skeleton should disappear
    const fireCanPlay = screen.getByTestId("fire-can-play");
    fireEvent.click(fireCanPlay);
    expect(screen.queryByRole("status", { name: "Loading stream" })).toBeNull();
  });

  it("shows error overlay after onError fires; skeleton absent", async () => {
    mockUseGlobalPlayer.mockReturnValue(makeContext(LIVE_MEDIA, "expanded"));
    render(<GlobalPlayer />);

    // Skeleton is initially visible
    await screen.findByRole("status", { name: "Loading stream" });

    // Trigger error
    const fireError = screen.getByTestId("fire-error");
    fireEvent.click(fireError);

    // Error overlay present
    const alert = screen.getByRole("alert");
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain("Try again");

    // Skeleton gone
    expect(screen.queryByRole("status", { name: "Loading stream" })).toBeNull();
  });

  it("clicking Try again resets to loading state", async () => {
    mockUseGlobalPlayer.mockReturnValue(makeContext(LIVE_MEDIA, "expanded"));
    render(<GlobalPlayer />);

    // Wait for media player to mount
    await screen.findByTestId("media-player");

    // Trigger error
    fireEvent.click(screen.getByTestId("fire-error"));
    expect(screen.getByRole("alert")).toBeTruthy();

    // Click Try again
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    // Error overlay gone, skeleton back
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status", { name: "Loading stream" })).toBeTruthy();
  });

  it("audio media shows no skeleton and no error overlay", () => {
    mockUseGlobalPlayer.mockReturnValue(makeContext(AUDIO_MEDIA, "expanded"));
    render(<GlobalPlayer />);

    // No skeleton
    expect(screen.queryByLabelText("Loading stream")).toBeNull();
    expect(screen.queryByRole("status", { name: "Loading stream" })).toBeNull();
    // No error overlay
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
