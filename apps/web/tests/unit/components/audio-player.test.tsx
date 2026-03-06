import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Hoisted Mocks ──

const { mockPlayTrack, mockPause, mockResume, mockSeek, mockSetVolume, mockClearTrack } =
  vi.hoisted(() => ({
    mockPlayTrack: vi.fn(),
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

import { AudioPlayer } from "../../../src/components/media/audio-player.js";
import {
  makeMockContext,
  TEST_TRACK,
} from "../../helpers/audio-player-fixtures.js";

// ── Constants ──

const DEFAULT_PROPS = {
  src: TEST_TRACK.mediaUrl,
  title: TEST_TRACK.title,
  creator: TEST_TRACK.creatorName,
  ...(TEST_TRACK.coverArtUrl != null && { coverArtUrl: TEST_TRACK.coverArtUrl }),
  contentId: TEST_TRACK.id,
};

const MOCK_ACTIONS = {
  playTrack: mockPlayTrack,
  pause: mockPause,
  resume: mockResume,
  seek: mockSeek,
  setVolume: mockSetVolume,
  clearTrack: mockClearTrack,
};

describe("AudioPlayer", () => {
  beforeEach(() => {
    mockUseAudioPlayer.mockReturnValue(makeMockContext(MOCK_ACTIONS));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders play button when no track is active", () => {
    render(<AudioPlayer {...DEFAULT_PROPS} />);
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("renders pause button when this track is playing", () => {
    mockUseAudioPlayer.mockReturnValue(
      makeMockContext(MOCK_ACTIONS, {
        track: TEST_TRACK,
        isPlaying: true,
        currentTime: 30,
        duration: 120,
      }),
    );
    render(<AudioPlayer {...DEFAULT_PROPS} />);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("calls playTrack when play is clicked and no track is active", async () => {
    const user = userEvent.setup();
    render(<AudioPlayer {...DEFAULT_PROPS} />);
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(mockPlayTrack).toHaveBeenCalledWith({
      id: TEST_TRACK.id,
      title: TEST_TRACK.title,
      creatorName: TEST_TRACK.creatorName,
      mediaUrl: TEST_TRACK.mediaUrl,
      coverArtUrl: TEST_TRACK.coverArtUrl,
    });
  });

  it("calls pause when pause button is clicked", async () => {
    const user = userEvent.setup();
    mockUseAudioPlayer.mockReturnValue(
      makeMockContext(MOCK_ACTIONS, {
        track: TEST_TRACK,
        isPlaying: true,
        currentTime: 30,
        duration: 120,
      }),
    );
    render(<AudioPlayer {...DEFAULT_PROPS} />);
    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(mockPause).toHaveBeenCalled();
  });

  it("calls resume when play is clicked and this track is paused", async () => {
    const user = userEvent.setup();
    mockUseAudioPlayer.mockReturnValue(
      makeMockContext(MOCK_ACTIONS, {
        track: TEST_TRACK,
        isPlaying: false,
        currentTime: 30,
        duration: 120,
      }),
    );
    render(<AudioPlayer {...DEFAULT_PROPS} />);
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(mockResume).toHaveBeenCalled();
  });

  it("renders time display as 0:00 / 0:00 when track is not active", () => {
    render(<AudioPlayer {...DEFAULT_PROPS} />);
    expect(screen.getByText("0:00 / 0:00")).toBeInTheDocument();
  });

  it("renders current time and duration when track is active", () => {
    mockUseAudioPlayer.mockReturnValue(
      makeMockContext(MOCK_ACTIONS, {
        track: TEST_TRACK,
        isPlaying: true,
        currentTime: 83,
        duration: 296,
      }),
    );
    render(<AudioPlayer {...DEFAULT_PROPS} />);
    expect(screen.getByText("1:23 / 4:56")).toBeInTheDocument();
  });

  it("renders progress bar disabled when track is not active", () => {
    render(<AudioPlayer {...DEFAULT_PROPS} />);
    const progressBar = screen.getByRole("slider", { name: "Seek" });
    expect(progressBar).toBeDisabled();
  });

  it("renders progress bar enabled when track is active", () => {
    mockUseAudioPlayer.mockReturnValue(
      makeMockContext(MOCK_ACTIONS, {
        track: TEST_TRACK,
        isPlaying: true,
        currentTime: 30,
        duration: 120,
      }),
    );
    render(<AudioPlayer {...DEFAULT_PROPS} />);
    const progressBar = screen.getByRole("slider", { name: "Seek" });
    expect(progressBar).not.toBeDisabled();
  });

  it("renders volume slider", () => {
    render(<AudioPlayer {...DEFAULT_PROPS} />);
    expect(screen.getByRole("slider", { name: "Volume" })).toBeInTheDocument();
  });

  it("renders a hidden audio element for metadata preloading", () => {
    render(<AudioPlayer {...DEFAULT_PROPS} />);
    const audio = document.querySelector("audio");
    expect(audio).not.toBeNull();
    expect(audio!.preload).toBe("metadata");
    expect(audio!.hidden).toBe(true);
    expect(audio!.src).toContain(TEST_TRACK.mediaUrl);
  });
});
