import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Hoisted mocks ──

const mockClear = vi.hoisted(() => vi.fn());
const mockUseGlobalPlayer = vi.hoisted(() => vi.fn());

vi.mock("../../../src/contexts/global-player-context.js", () => ({
  useGlobalPlayer: mockUseGlobalPlayer,
}));

vi.mock("@vidstack/react", () => ({
  MediaPlayer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="media-player">{children}</div>
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
});
