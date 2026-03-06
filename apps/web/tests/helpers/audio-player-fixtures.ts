import type {
  AudioTrack,
  AudioPlayerActions,
  AudioPlayerState,
  AudioPlayerContextValue,
} from "../../src/contexts/audio-player-context.js";

// ── Public API ──

export const TEST_TRACK: AudioTrack = {
  id: "track-1",
  title: "Test Song",
  creatorName: "Test Artist",
  mediaUrl: "/api/content/track-1/media",
  coverArtUrl: "/api/content/track-1/cover-art",
};

export function makeMockContext(
  actions: AudioPlayerActions,
  overrides?: Partial<AudioPlayerState>,
): AudioPlayerContextValue {
  return {
    state: {
      track: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      ...overrides,
    },
    actions,
  };
}
