import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Hoisted Mocks ──

const { mockPause, mockResume, mockSeek, mockSetVolume, mockClearTrack } = vi.hoisted(() => ({
  mockPause: vi.fn(),
  mockResume: vi.fn(),
  mockSeek: vi.fn(),
  mockSetVolume: vi.fn(),
  mockClearTrack: vi.fn(),
}));

const { mockUseAudioPlayer } = vi.hoisted(() => ({
  mockUseAudioPlayer: vi.fn(),
}));

vi.mock("../../../src/contexts/audio-player-context.js", () => ({
  useAudioPlayer: mockUseAudioPlayer,
}));

// ── Import component under test (after mocks) ──

import { MiniPlayer } from "../../../src/components/media/mini-player.js";
import {
  makeMockContext,
  TEST_TRACK,
} from "../../helpers/audio-player-fixtures.js";

// ── Constants ──

const MOCK_ACTIONS = {
  playTrack: vi.fn(),
  pause: mockPause,
  resume: mockResume,
  seek: mockSeek,
  setVolume: mockSetVolume,
  clearTrack: mockClearTrack,
};

// ── Tests ──

describe("MiniPlayer", () => {
  beforeEach(() => {
    mockUseAudioPlayer.mockReturnValue(makeMockContext(MOCK_ACTIONS));
  });

  afterEach(() => {
    document.body.style.removeProperty("--mini-player-height");
  });

  it("renders nothing when no track is set", () => {
    const { container } = render(<MiniPlayer />);
    expect(container.firstChild).toBeNull();
  });

  it("renders when a track is set", () => {
    mockUseAudioPlayer.mockReturnValue(
      makeMockContext(MOCK_ACTIONS, { track: TEST_TRACK, isPlaying: true }),
    );
    render(<MiniPlayer />);
    expect(
      screen.getByRole("region", { name: "Audio player" }),
    ).toBeInTheDocument();
  });

  it("displays track title and creator name", () => {
    mockUseAudioPlayer.mockReturnValue(
      makeMockContext(MOCK_ACTIONS, { track: TEST_TRACK, isPlaying: true }),
    );
    render(<MiniPlayer />);
    expect(screen.getByText("Test Song")).toBeInTheDocument();
    expect(screen.getByText("Test Artist")).toBeInTheDocument();
  });

  it("displays cover art image when coverArtUrl is present", () => {
    mockUseAudioPlayer.mockReturnValue(
      makeMockContext(MOCK_ACTIONS, { track: TEST_TRACK, isPlaying: true }),
    );
    render(<MiniPlayer />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", TEST_TRACK.coverArtUrl);
    expect(img).toHaveAttribute(
      "alt",
      expect.stringContaining("Test Song"),
    );
  });

  it("displays placeholder when coverArtUrl is null", () => {
    mockUseAudioPlayer.mockReturnValue(
      makeMockContext(MOCK_ACTIONS, {
        track: { ...TEST_TRACK, coverArtUrl: null },
        isPlaying: true,
      }),
    );
    render(<MiniPlayer />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders pause button when track is playing", () => {
    mockUseAudioPlayer.mockReturnValue(
      makeMockContext(MOCK_ACTIONS, {
        track: TEST_TRACK,
        isPlaying: true,
      }),
    );
    render(<MiniPlayer />);
    expect(
      screen.getByRole("button", { name: "Pause" }),
    ).toBeInTheDocument();
  });

  it("renders play button when track is paused", () => {
    mockUseAudioPlayer.mockReturnValue(
      makeMockContext(MOCK_ACTIONS, {
        track: TEST_TRACK,
        isPlaying: false,
      }),
    );
    render(<MiniPlayer />);
    expect(
      screen.getByRole("button", { name: "Play" }),
    ).toBeInTheDocument();
  });

  it("calls pause when pause button is clicked", async () => {
    const user = userEvent.setup();
    mockUseAudioPlayer.mockReturnValue(
      makeMockContext(MOCK_ACTIONS, {
        track: TEST_TRACK,
        isPlaying: true,
      }),
    );
    render(<MiniPlayer />);
    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(mockPause).toHaveBeenCalled();
  });

  it("calls resume when play button is clicked", async () => {
    const user = userEvent.setup();
    mockUseAudioPlayer.mockReturnValue(
      makeMockContext(MOCK_ACTIONS, {
        track: TEST_TRACK,
        isPlaying: false,
      }),
    );
    render(<MiniPlayer />);
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(mockResume).toHaveBeenCalled();
  });

  it("calls clearTrack when close button is clicked", async () => {
    const user = userEvent.setup();
    mockUseAudioPlayer.mockReturnValue(
      makeMockContext(MOCK_ACTIONS, {
        track: TEST_TRACK,
        isPlaying: true,
      }),
    );
    render(<MiniPlayer />);
    await user.click(screen.getByRole("button", { name: "Close player" }));
    expect(mockClearTrack).toHaveBeenCalled();
  });

  it("renders progress bar with current time and duration", () => {
    mockUseAudioPlayer.mockReturnValue(
      makeMockContext(MOCK_ACTIONS, {
        track: TEST_TRACK,
        isPlaying: true,
        currentTime: 83,
        duration: 296,
      }),
    );
    render(<MiniPlayer />);
    expect(screen.getByText("1:23 / 4:56")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Seek" })).toBeInTheDocument();
  });

  it("sets --mini-player-height on document.body when track is present", () => {
    mockUseAudioPlayer.mockReturnValue(
      makeMockContext(MOCK_ACTIONS, { track: TEST_TRACK }),
    );
    render(<MiniPlayer />);
    expect(
      document.body.style.getPropertyValue("--mini-player-height"),
    ).toBe("56px");
  });

  it("resets --mini-player-height when track is cleared", () => {
    const { rerender } = render(<MiniPlayer />);
    // Initially no track — should be 0px
    expect(
      document.body.style.getPropertyValue("--mini-player-height"),
    ).toBe("0px");

    // Set a track
    mockUseAudioPlayer.mockReturnValue(
      makeMockContext(MOCK_ACTIONS, { track: TEST_TRACK }),
    );
    rerender(<MiniPlayer />);
    expect(
      document.body.style.getPropertyValue("--mini-player-height"),
    ).toBe("56px");

    // Clear the track
    mockUseAudioPlayer.mockReturnValue(makeMockContext(MOCK_ACTIONS));
    rerender(<MiniPlayer />);
    expect(
      document.body.style.getPropertyValue("--mini-player-height"),
    ).toBe("0px");
  });

  it("renders volume slider when track is set", () => {
    mockUseAudioPlayer.mockReturnValue(
      makeMockContext(MOCK_ACTIONS, { track: TEST_TRACK, isPlaying: true }),
    );
    render(<MiniPlayer />);
    expect(screen.getByRole("slider", { name: "Volume" })).toBeInTheDocument();
  });

  it("calls setVolume when volume slider changes", () => {
    mockUseAudioPlayer.mockReturnValue(
      makeMockContext(MOCK_ACTIONS, { track: TEST_TRACK, isPlaying: true }),
    );
    render(<MiniPlayer />);
    const slider = screen.getByRole("slider", { name: "Volume" });
    fireEvent.change(slider, { target: { value: "0.5" } });
    expect(mockSetVolume).toHaveBeenCalledWith(0.5);
  });

  it("does not render an audio element", () => {
    mockUseAudioPlayer.mockReturnValue(
      makeMockContext(MOCK_ACTIONS, { track: TEST_TRACK, isPlaying: true }),
    );
    render(<MiniPlayer />);
    expect(document.querySelector("audio")).toBeNull();
  });
});
