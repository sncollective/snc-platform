# Pattern: React Context + Reducer Provider

A structured approach for global client-side state: separate `State`/`Actions`/`ContextValue` interfaces, an exported pure `reducer`, a `Provider` component that bridges a DOM ref to the reducer via `useMemo` actions, and a null-guarded consumer hook.

## Rationale

Splitting `State` (read) from `Actions` (write) into separate exported interfaces lets consumers depend only on what they need, and makes the reducer testable in pure isolation. Exporting `INITIAL_STATE` and the reducer allows direct unit tests without mounting the provider. Memoizing the `actions` object with `useMemo` prevents unnecessary re-renders in consumers that only call actions. The null-guard in the hook catches usage outside the provider at runtime.

## Examples

### Example 1: Full context module structure
**File**: `apps/web/src/contexts/audio-player-context.tsx:14-191`
```typescript
// ── Public Types ──
export interface AudioTrack { readonly id: string; ... }

export interface AudioPlayerState {
  readonly track: AudioTrack | null;
  readonly isPlaying: boolean;
  readonly currentTime: number;
  readonly duration: number;
}

export interface AudioPlayerActions {
  readonly playTrack: (track: AudioTrack) => void;
  readonly pause: () => void;
  readonly seek: (time: number) => void;
  readonly clearTrack: () => void;
}

export interface AudioPlayerContextValue {
  readonly state: AudioPlayerState;
  readonly actions: AudioPlayerActions;
}

// ── Constants ──
export const INITIAL_STATE: AudioPlayerState = {
  track: null, isPlaying: false, currentTime: 0, duration: 0,
};

// ── Reducer (exported for unit testing) ──
type AudioAction =
  | { readonly type: "SET_TRACK"; readonly track: AudioTrack }
  | { readonly type: "PLAY" }
  | { readonly type: "PAUSE" }
  | { readonly type: "SET_PROGRESS"; readonly currentTime: number }
  | { readonly type: "CLEAR" };

export function audioReducer(state: AudioPlayerState, action: AudioAction): AudioPlayerState {
  switch (action.type) {
    case "SET_TRACK": return { track: action.track, isPlaying: true, currentTime: 0, duration: 0 };
    case "PLAY":      return { ...state, isPlaying: true };
    case "PAUSE":     return { ...state, isPlaying: false };
    case "CLEAR":     return INITIAL_STATE;
  }
}

// ── Provider ──
const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export function AudioPlayerProvider({ children }: Readonly<{ children: ReactNode }>): React.ReactElement {
  const [state, dispatch] = useReducer(audioReducer, INITIAL_STATE);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Bridge DOM element events → reducer dispatches
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => dispatch({ type: "PLAY" });
    const onPause = () => dispatch({ type: "PAUSE" });
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  // Stable actions object — does NOT depend on state
  const actions = useMemo<AudioPlayerActions>(() => ({
    playTrack(track) {
      dispatch({ type: "SET_TRACK", track });
      const audio = audioRef.current;
      if (audio) { audio.src = track.mediaUrl; void audio.play(); }
    },
    pause()  { audioRef.current?.pause(); },
    resume() { void audioRef.current?.play(); },
    seek(time)   { if (audioRef.current) audioRef.current.currentTime = time; },
    clearTrack() {
      const audio = audioRef.current;
      if (audio) { audio.pause(); audio.src = ""; dispatch({ type: "CLEAR" }); }
    },
  }), []);

  const value = useMemo(() => ({ state, actions }), [state, actions]);

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
  if (!context) throw new Error("useAudioPlayer must be used within an AudioPlayerProvider");
  return context;
}
```

### Example 2: Provider placement in root layout
**File**: `apps/web/src/routes/__root.tsx:43-50`
```typescript
// AudioPlayerProvider wraps the entire app so any route can consume audio state.
// MiniPlayer is placed *outside* <Outlet /> so it persists across route transitions.
function RootComponent() {
  return (
    <RootDocument>
      <AudioPlayerProvider>
        <NavBar />
        <main className="main-content"><Outlet /></main>
        <MiniPlayer />
        <Footer />
      </AudioPlayerProvider>
    </RootDocument>
  );
}
```

### Example 3: Consumer using context hook
**File**: `apps/web/src/components/media/audio-player.tsx:28-50`
```typescript
export function AudioPlayer({ src, title, creator, coverArtUrl, contentId }: AudioPlayerProps) {
  const { state, actions } = useAudioPlayer();

  // Determine if *this* component's track is currently active
  const isThisTrack = state.track?.id === contentId;
  const isPlayingThis = isThisTrack && state.isPlaying;

  function handlePlayPause() {
    if (!isThisTrack) {
      // Start new track — dispatches SET_TRACK
      actions.playTrack({ id: contentId, title, creatorName: creator, mediaUrl: src, coverArtUrl: coverArtUrl ?? null });
    } else if (isPlayingThis) {
      actions.pause();
    } else {
      actions.resume();
    }
  }
  // ...
}
```

### Example 4: Testing the reducer in isolation
**File**: `apps/web/tests/unit/contexts/audio-player-context.test.tsx`
```typescript
import { audioReducer, INITIAL_STATE } from "../../../src/contexts/audio-player-context.js";

describe("audioReducer", () => {
  it("SET_TRACK resets progress and plays", () => {
    const next = audioReducer(INITIAL_STATE, { type: "SET_TRACK", track: TEST_TRACK });
    expect(next.track).toEqual(TEST_TRACK);
    expect(next.isPlaying).toBe(true);
    expect(next.currentTime).toBe(0);
  });
});

// Testing the hook via renderHook + wrapper
function wrapper({ children }: Readonly<{ children: ReactNode }>) {
  return <AudioPlayerProvider>{children}</AudioPlayerProvider>;
}
const { result } = renderHook(() => useAudioPlayer(), { wrapper });
```

## When to Use

- Global media/playback state that persists across route transitions
- State where the source of truth is a DOM element (audio, video) that must stay mounted
- State with both read (state display) and write (action dispatch) consumers that need isolation

## When NOT to Use

- Simple UI state local to a component — use `useState` instead
- Server state (API data) — use TanStack Router's `loader` + `Route.useLoaderData()`
- Derived state with no side effects — just compute from props

## Common Violations

- Putting actions directly in the context value without `useMemo` — causes all consumers to re-render whenever state changes, even if they only call actions
- Not exporting `INITIAL_STATE` and `reducer` — makes reducer logic impossible to unit test without mounting the full provider
- Using `useState` instead of `useReducer` for multi-field state with transitions — leads to multiple `setState` calls in action handlers and race conditions
- Creating the context without a null default + null-guard hook — allows silent failures when a consumer is accidentally placed outside the provider
