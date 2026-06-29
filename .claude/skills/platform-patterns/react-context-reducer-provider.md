# Pattern: React Context + Reducer Provider

A structured approach for global client-side state: separate `State`/`Actions`/`ContextValue` interfaces, an exported pure `reducer`, a `Provider` component that bridges a DOM ref to the reducer via `useMemo` actions, and a null-guarded consumer hook.

## Rationale

Splitting `State` (read) from `Actions` (write) into separate exported interfaces lets consumers depend only on what they need, and makes the reducer testable in pure isolation. Exporting `INITIAL_STATE` and the reducer allows direct unit tests without mounting the provider. Memoizing the `actions` object with `useMemo` prevents unnecessary re-renders in consumers that only call actions. The null-guard in the hook catches usage outside the provider at runtime.

## Examples

### Example 1: Full context module structure
**File**: `apps/web/src/contexts/global-player-context.tsx:33-176`
```typescript
export interface GlobalPlayerState {
  readonly media: MediaMetadata | null;
  readonly activeDetailId: string | null;
  readonly shouldAutoPlay: boolean;
}

export interface GlobalPlayerActions {
  readonly play: (media: MediaMetadata) => void;
  readonly clear: () => void;
  readonly setActiveDetail: (id: string | null) => void;
}

export interface GlobalPlayerContextValue {
  readonly state: GlobalPlayerState;
  readonly presentation: PlayerPresentation;
  readonly actions: GlobalPlayerActions;
  readonly chatPortalRef: React.RefObject<HTMLDivElement | null>;
}

export const INITIAL_STATE: GlobalPlayerState = { /* ... */ };

export function globalPlayerReducer(
  state: GlobalPlayerState,
  action: GlobalPlayerAction,
): GlobalPlayerState {
  switch (action.type) {
    case "PLAY": return { ...state, media: action.media, shouldAutoPlay: true };
    case "CLEAR": return INITIAL_STATE;
    case "SET_ACTIVE_DETAIL": return { ...state, activeDetailId: action.id };
    // ...
  }
}

const GlobalPlayerContext = createContext<GlobalPlayerContextValue | null>(null);

export function GlobalPlayerProvider({ children }: Readonly<{ children: ReactNode }>): React.ReactElement {
  const [state, dispatch] = useReducer(globalPlayerReducer, INITIAL_STATE);
  const chatPortalRef = useRef<HTMLDivElement | null>(null);
  const actions = useMemo<GlobalPlayerActions>(() => ({ /* dispatching actions */ }), []);
  const value = useMemo<GlobalPlayerContextValue>(
    () => ({ state, presentation, actions, chatPortalRef }),
    [state, presentation, actions],
  );
  return <GlobalPlayerContext value={value}>{children}</GlobalPlayerContext>;
}

export function useGlobalPlayer(): GlobalPlayerContextValue {
  const context = useContext(GlobalPlayerContext);
  if (!context) throw new Error("useGlobalPlayer must be used within a GlobalPlayerProvider");
  return context;
}
```

### Example 2: Provider placement in root layout
**File**: `apps/web/src/routes/__root.tsx:88-92,99-123`
```typescript
<NotificationProvider userId={authState?.user?.id ?? null}>
  <GlobalPlayerProvider>
    <UploadProvider>
      <AppShell serverAuth={authState} />
    </UploadProvider>
  </GlobalPlayerProvider>
</NotificationProvider>

function AppShell({ serverAuth }: { readonly serverAuth?: AuthState }) {
  const { state: playerState, chatPortalRef } = useGlobalPlayer();
  // ...
  return (
    <main id="main-content" className={clsx(/* layout classes */)}>
      <GlobalPlayer />
      <div className={clsx(isLiveLayout && styles.outletColumn)}>
        <Outlet />
      </div>
      <div ref={chatPortalRef} />
    </main>
  );
}
```

### Example 3: Consumer using context hook
**File**: `apps/web/src/components/media/global-player.tsx:28-29`
```typescript
export function GlobalPlayer() {
  const { state, presentation, actions } = useGlobalPlayer();
  // ...
}
```

### Example 4: Testing the reducer in isolation
**File**: `apps/web/tests/unit/contexts/global-player-context.test.tsx:5-100`
```typescript
import {
  GlobalPlayerProvider,
  globalPlayerReducer,
  useGlobalPlayer,
  INITIAL_STATE,
} from "../../../src/contexts/global-player-context.js";

describe("globalPlayerReducer", () => {
  it("PLAY sets media", () => {
    const next = globalPlayerReducer(INITIAL_STATE, { type: "PLAY", media: AUDIO_MEDIA });
    expect(next.media).toEqual(AUDIO_MEDIA);
  });
});

function wrapper({ children }: Readonly<{ children: ReactNode }>): React.ReactElement {
  return <GlobalPlayerProvider>{children}</GlobalPlayerProvider>;
}

const { result } = renderHook(() => useGlobalPlayer(), { wrapper });
```

## When to Use

- Global media/playback state that persists across route transitions
- State where the source of truth is a DOM element (audio, video) that must stay mounted
- Web Audio API integration (lazy AudioContext/GainNode for smooth volume control)
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
