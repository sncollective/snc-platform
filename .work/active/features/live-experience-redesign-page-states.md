---
id: live-experience-redesign-page-states
kind: feature
stage: done
tags: [streaming]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-13
parent: live-experience-redesign
---

# Honest page states — loading, offline, empty, gated

## Brief
Every state the live page can be in says what's happening and what to do next. Covers:
the 12–15s cold-start dead air (wire a pulsing 16:9 player skeleton — the
`playerSkeleton` class already exists orphaned in `live.module.css:161`; also a
loading state for the channel-selector zone during the initial fetch), a custom HLS
error state (today Vidstack's native error then silent clear), the offline state
(replace "Coming Soon — stay tuned" with honest "Nothing live right now" copy plus a
link to the existing `/calendar` route showing upcoming events, per the epic's design
decision), anonymous chat pre-gating (disable the input with "Sign in to chat" + login
link instead of today's type-send-fail-toast pattern — sev-3 both viewports), the chat
empty state ("No messages yet"), and the chat viewer-count accessible label (absorbs
backlog item `a11y-viewer-chat-viewercount-label` — close it when this lands).

Spine-independent by design: nothing here needs live data that polling doesn't already
provide, so this feature can start immediately. Does NOT cover the notify-me
subscription affordance (sibling `notify-me` — the offline state links to calendar
now; notify-me adds its capture affordance to the same surface when it lands) or live
indicators (sibling `live-state`).

Audit grounding: viewer findings V1 (skeleton sev-3 ×2, loading sev-2, ComingSoon
sev-2) and V5 (anon gating sev-3 ×2, empty chat sev-2, viewer-count sev-2), plus the
state-inspection table's six handled-poorly verdicts, in the
`streaming-playout-ux-review-viewer-audit` story (archived; body at git 85151fd).

## Epic context
- Parent epic: `live-experience-redesign`
- Position in epic: independent capability — no dependencies, can be designed and
  implemented first while the spine features land.

## Foundation references
- `docs/streaming.md` — viewer flow
- `docs/ux-decisions.md` — error-prevention and status-visibility evidence

## Design decisions

Resolved with judgment (lane delegation; no interactive checkpoint available). Advisory
peer pass skipped — UI-state work, no architectural decisions; the epic pinned the
load-bearing choices.

- **Skeleton lifetime — until first `canPlay`, not until Vidstack modules load**: the
  audit's 12–15s window includes the HLS handshake after the JS bundle lands; a
  modules-only skeleton would still leave seconds of dead air.
- **Skeleton CSS home — `global-player.module.css`, not `live.module.css`**: the player
  renders at root-grid level via global-player-context, outside the live route's JSX
  tree — live.module.css can't reach it (same reason the controls-visibility handlers
  live on `window`). The orphaned `playerSkeleton` class in live.module.css is deleted
  by the story that owns that file (Unit 2), keeping story write-sets disjoint.
- **Error recovery — overlay includes a "Try again" remount, not message-only**:
  error-recovery heuristic; cheap (key bump). Interplays safely with the existing
  3-miss status-poll clear in `global-player.tsx` — if the channel is genuinely gone,
  the poll dismisses the player ~30s later regardless.
- **Sign-in link target — `buildLoginRedirect("/live")` with a static path**: ChatPanel
  is portaled and doesn't know router location; the `?channel` param is non-essential
  (default-channel auto-select covers return). Avoids new router-location coupling in
  the panel.
- **"Chat unavailable" state included**: the brief's grounding (state-inspection
  handled-poorly verdicts) names the silent no-room blank. One guarded div plus a
  `roomsLoaded` flag; same surface as the empty state, so absorbed into Unit 3.
- **Audio media excluded from skeleton/error overlay**: audio uses the bar layout with
  no 16:9 frame; the audit scope is the live viewer page. Non-audio VOD (video detail
  pages) does get the skeleton — the state table flagged the `modules === null` blank
  generally, and the fix is content-type-agnostic for video shapes.

## Architectural choice

**Each surface owns its honest states** (chosen): `GlobalPlayer` tracks a local
`loading | ready | error` status from Vidstack events and renders the skeleton/error
overlays; the live route owns the channel-zone loading skeleton and offline
placeholder; ChatPanel owns gating, empty, and unavailable states. Three disjoint
write-sets, no shared state, no new context surface.

Rejected:
- **Route-owned overlays in live.tsx** — the player renders outside the route tree
  (root grid); a route-scoped element can't cover the player region, and a portal hack
  would couple the route to player internals.
- **Status in global-player-context reducer** — over-engineering: status is a local
  render concern of one component; a reducer change ripples through context tests and
  consumers, and the sibling `live-state` feature will add *server*-truth state
  separately on the event spine. Keeping client playback status local avoids two
  state-of-the-stream representations colliding in one context.

## Implementation Units

### Unit 1: Player cold-start skeleton + HLS error state
**Files**: `apps/web/src/components/media/global-player.tsx`,
`apps/web/src/components/media/global-player.module.css`
**Story**: `live-experience-redesign-page-states-player-skeleton`

```tsx
type PlayerStatus = "loading" | "ready" | "error";

// inside GlobalPlayer():
const [status, setStatus] = useState<PlayerStatus>("loading");
const [retryKey, setRetryKey] = useState(0);

// Reset to loading whenever the media item changes (channel switch, new content)
useEffect(() => {
  setStatus("loading");
}, [mediaId]);
```

MediaPlayer gains:

```tsx
key={`${media.id}:${retryKey}`}
onCanPlay={() => setStatus("ready")}
onError={() => setStatus("error")}
```

Overlays render inside the container div, after the modules IIFE (non-audio only):

```tsx
{!isAudio && status === "loading" && (
  <div className={styles.playerSkeleton} role="status" aria-label="Loading stream" />
)}
{!isAudio && status === "error" && (
  <div className={styles.playerError} role="alert">
    <p className={styles.playerErrorText}>
      The stream couldn&apos;t be loaded. It may have just ended, or the connection
      hiccuped.
    </p>
    <button
      type="button"
      className={styles.playerErrorRetry}
      onClick={() => {
        setRetryKey((k) => k + 1);
        setStatus("loading");
      }}
    >
      Try again
    </button>
  </div>
)}
```

Container class composes a pending-frame modifier so the expanded container has height
before Vidstack mounts (today it collapses to 0px — that IS the dead air):

```tsx
<div
  className={clsx(containerClass, !isAudio && status !== "ready" && styles.pendingFrame)}
  data-presentation={presentation}
>
```

CSS (new in global-player.module.css; `pulse` keyframes move here from live.module.css):

```css
.pendingFrame { aspect-ratio: 16 / 9; position: relative; }
.playerSkeleton {
  position: absolute; inset: 0;
  background: var(--color-bg-elevated);
  animation: pulse 1.5s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) { .playerSkeleton { animation: none; } }
.playerError {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--space-sm); background: var(--color-media-bg);
  text-align: center; padding: var(--space-md);
}
```

**Implementation Notes**:
- `onCanPlay` / `onError` are event-callback props on `MediaPlayer`
  (`MediaPlayerProps extends ReactElementProps<MediaPlayerInstance>` maps instance
  events to `on*` props — verified against installed @vidstack/react 1.12.13 types).
  First implementation step is a typecheck of these props; fallback if TS rejects:
  a tiny child component inside `MediaPlayer` using `useMediaState("canPlay")` /
  `useMediaState("error")` that reports up via callback.
- The error overlay sits above the still-mounted MediaPlayer (absolute, inset 0) —
  no unmount on error, so hls.js internal retries continue underneath.
- `hidden` presentation hides overlays along with the container (`display: none`).
- `.expanded` needs no other change; `.collapsedOverlay` already has aspect-ratio and
  is `position: fixed` so absolute overlay children anchor correctly.

**Acceptance Criteria**:
- [ ] On live cold start the 16:9 player area shows a pulsing skeleton from mount until
      Vidstack fires `canPlay` — no zero-height window, no blank frame
- [ ] Player error replaces the skeleton with honest copy and a working "Try again"
      button that remounts the player (key bump) and returns to the skeleton state
- [ ] Switching channels resets status to loading (skeleton shows again)
- [ ] Audio content renders no skeleton, no pending frame, no error overlay
- [ ] Skeleton animation disabled under `prefers-reduced-motion: reduce`

---

### Unit 2: Channel-zone loading skeleton + honest offline state
**Files**: `apps/web/src/routes/live.tsx`, `apps/web/src/routes/live.module.css`
**Story**: `live-experience-redesign-page-states-offline-loading`

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";

/** Pulsing placeholder for the channel selector zone during the initial fetch. */
function ChannelZoneSkeleton(): React.ReactElement {
  return (
    <div className={styles.channelZoneSkeleton} role="status" aria-label="Loading channels">
      <span className={styles.skeletonSelect} aria-hidden="true" />
      <span className={styles.skeletonLine} aria-hidden="true" />
    </div>
  );
}

/** Placeholder shown when no channels are active. */
function OfflinePlaceholder(): React.ReactElement {
  return (
    <div className={styles.offline}>
      <h1 className={styles.offlineHeading}>Nothing live right now</h1>
      <p className={styles.offlineText}>
        No channels are streaming at the moment. Check the calendar for upcoming
        shows and streams.
      </p>
      <Link to="/calendar" className={styles.offlineCalendarLink}>
        View the calendar
      </Link>
    </div>
  );
}
```

Render wiring in `LivePage`:

```tsx
{isLoading && <ChannelZoneSkeleton />}
{!hasChannels && !isLoading && <OfflinePlaceholder />}
```

`ComingSoonPlaceholder` is deleted (replaced by `OfflinePlaceholder`).

**Implementation Notes**:
- `/calendar` 301-redirects to `/governance/calendar` (general S/NC events calendar).
  Link to `/calendar` per the epic decision — it's the stable public alias; the
  redirect is client-handled by the router.
- CSS: rename `.comingSoon*` classes to `.offline*`; add `.channelZoneSkeleton`
  (flex row, gap `var(--space-md)`), `.skeletonSelect` (240px × 36px block matching
  the selector footprint, `var(--color-bg-elevated)`, pulse animation, radius
  `var(--radius-sm)`), `.skeletonLine` (~80px × 16px). Keep the `pulse` keyframes
  (now used by these classes); delete the orphaned `.playerSkeleton` class — its
  replacement lives in global-player.module.css (Unit 1). Add the same
  `prefers-reduced-motion` guard.
- `.offlineCalendarLink`: accent-colored link (`var(--color-accent)`), underline on
  hover — follows existing link conventions, no new button variant.
- The sibling `notify-me` feature adds its capture affordance to this same offline
  surface later; keep `OfflinePlaceholder` a simple named component so it has an
  obvious extension point.

**Acceptance Criteria**:
- [ ] With no SSR data, the channel-selector zone shows a pulsing placeholder until the
      first client fetch resolves (no blank main area)
- [ ] With zero active channels, the page shows "Nothing live right now" with honest
      copy and a working link to `/calendar`
- [ ] "Coming Soon" copy no longer exists anywhere on the live page
- [ ] The orphaned `.playerSkeleton` class is gone from live.module.css; `pulse`
      keyframes remain and drive the channel-zone skeleton

---

### Unit 3: Chat pre-gating, empty state, unavailable state, viewer-count label
**Files**: `apps/web/src/components/chat/chat-panel.tsx`,
`apps/web/src/components/chat/chat-panel.module.css`
**Story**: `live-experience-redesign-page-states-chat-states`

```tsx
import { Link } from "@tanstack/react-router";
import { buildLoginRedirect } from "../../lib/return-to.js";

const SIGN_IN_REDIRECT = buildLoginRedirect("/live");

// inside ChatPanel():
const isAnonymous = state.currentUserId === null;
const [roomsLoaded, setRoomsLoaded] = useState(false);
```

`loadRooms` gains try/finally so a failed rooms fetch lands in the unavailable state
instead of an unhandled rejection + silent blank:

```tsx
async function loadRooms(): Promise<void> {
  try {
    const res = await apiGet<ActiveRoomsResponse>("/api/chat/rooms");
    // ...existing room-selection logic...
  } catch {
    // Rooms unavailable — fall through to the "Chat unavailable" state
  } finally {
    setRoomsLoaded(true);
  }
}
```

Empty state inside the messages div (before the map):

```tsx
{state.messages.length === 0 && (
  <p className={styles.emptyState}>No messages yet</p>
)}
```

Input section becomes a four-way branch (anon gate / form / stream ended / unavailable):

```tsx
{activeRoom && !activeRoom.closedAt ? (
  isAnonymous ? (
    <div className={styles.inputForm}>
      <input
        type="text"
        className={styles.input}
        placeholder="Sign in to chat"
        disabled
        aria-label="Chat message (sign in to send)"
      />
      <Link
        to={SIGN_IN_REDIRECT.to}
        {...(SIGN_IN_REDIRECT.search ? { search: SIGN_IN_REDIRECT.search } : {})}
        className={styles.signInLink}
      >
        Sign in
      </Link>
    </div>
  ) : (
    /* existing form, unchanged */
  )
) : activeRoom?.closedAt ? (
  <div className={styles.closedBanner}>Stream ended</div>
) : roomsLoaded ? (
  <div className={styles.closedBanner}>Chat unavailable</div>
) : null}
```

Viewer count gains its accessible name (absorbs backlog
`a11y-viewer-chat-viewercount-label` — delete the backlog file in this story's commit):

```tsx
<span
  className={styles.viewerCount}
  title="Viewers in this room"
  aria-label={`${state.viewerCount} ${state.viewerCount === 1 ? "viewer" : "viewers"} in this room`}
>
  {state.viewerCount}
</span>
```

**Implementation Notes**:
- CSS: `.emptyState` (muted text, centered, `var(--space-md)` padding), `.signInLink`
  (accent link, self-centered in the input row). Reuse `.inputForm` / `.input` for the
  gated row so the gate is visually identical to the real input.
- The anon branch must keep the input `disabled` — the whole point is no
  type-send-fail path. Send button is absent in the gated row (link replaces it).
- `chat-panel.test.tsx` will need `vi.mock("@tanstack/react-router", () =>
  createRouterMock())` for the Link import (the shared helper's StubLink renders an
  `<a>` with search params).

**Acceptance Criteria**:
- [ ] Anonymous viewer sees a disabled input reading "Sign in to chat" plus a sign-in
      link carrying `returnTo=/live`; typing/sending is impossible (both viewports —
      the gate is markup, not media-query-dependent)
- [ ] Signed-in experience unchanged (input enabled, send works)
- [ ] Empty room shows "No messages yet" in the messages area
- [ ] Rooms loaded with no joinable room (or rooms fetch failed) shows
      "Chat unavailable" — never a silent blank; no flash before rooms resolve
- [ ] Viewer-count span exposes `aria-label="N viewer(s) in this room"`;
      backlog item `a11y-viewer-chat-viewercount-label` closed (file deleted)

---

## Implementation Order

No inter-unit dependencies — write-sets are disjoint (player files / live-route files /
chat files). Any order, or parallel via the implement-orchestrator:

1. `live-experience-redesign-page-states-player-skeleton` (trickiest — Vidstack event
   props; do its typecheck spike first)
2. `live-experience-redesign-page-states-offline-loading`
3. `live-experience-redesign-page-states-chat-states`

## Testing

Existing suites extended in place (Vitest + Testing Library, hoisted mocks per
project pattern):

### `tests/unit/components/global-player.test.tsx`
- Extend the Vidstack mock so `MediaPlayer` exposes its `onCanPlay`/`onError` props
  (render a div with click-trigger hooks or capture the props object).
- Skeleton present on mount with video/live media; removed after `onCanPlay` fires.
- Error overlay (role="alert" + "Try again") after `onError`; clicking retry returns
  the skeleton and changes the MediaPlayer key.
- Audio media: no skeleton, no pendingFrame class.

### `tests/unit/routes/live.test.tsx`
- Loader-null + pending fetch → channel-zone skeleton (`role="status"`) rendered.
- Channels empty + not loading → "Nothing live right now" heading + link with
  `href="/calendar"` (StubLink renders `<a>`).
- Assert "Coming Soon" absent.

### `tests/unit/components/chat/chat-panel.test.tsx`
- Add router mock (`createRouterMock()`).
- `currentUserId: null` + open room → disabled input with "Sign in to chat"
  placeholder, sign-in link present, no enabled send button.
- `currentUserId` set → existing enabled-input assertions still pass.
- `messages: []` → "No messages yet" visible.
- Rooms resolved to `[]` → "Chat unavailable" visible; while the rooms promise is
  unresolved → neither "Chat unavailable" nor the form's enabled state asserted
  (no-flash guard).
- Viewer-count span has the pluralized `aria-label` (1 viewer / N viewers).

## Risks

- **Vidstack event-prop names**: `onCanPlay`/`onError` verified as the v1.12.13 React
  pattern via `ReactElementProps<MediaPlayerInstance>`, but the exact prop-name mapping
  is generated — the typecheck spike at the top of story 1 de-risks it; named fallback
  is a `useMediaState` bridge child.
- **`canPlay` vs first visual frame on live HLS**: `canPlay` can fire slightly before
  a frame paints. Accepted — the controls/poster region is active by then; the audit's
  complaint was the multi-second blank, not sub-second paint gaps.
- **live.module.css contention with sibling `layout-ergonomics`**: both features edit
  live.tsx/live.module.css; the epic already mandates serialization and this feature
  lands first (lane order). The CSS this feature touches (skeleton + offline classes)
  is additive and survives the later restructure.

## Implementation summary (orchestrated run, 2026-06-13)

All three child stories implemented in one parallel wave (disjoint write-sets, no
worktree isolation needed) and advanced to review:

- `live-experience-redesign-page-states-player-skeleton` — the Vidstack event-prop
  spike succeeded directly (`onCanPlay`/`onError` generated from the instance event
  map; no `useMediaState` fallback needed). Skeleton + error overlay + pendingFrame
  landed per design.
- `live-experience-redesign-page-states-offline-loading` — landed per design; the
  orphaned `.playerSkeleton` class removed from live.module.css.
- `live-experience-redesign-page-states-chat-states` — landed per design; backlog
  item `a11y-viewer-chat-viewercount-label` absorbed and deleted.

No cross-cutting deviations. Wave-level verification by the orchestrator after all
three commits: web unit suite 1642/1642 across 153 files, `@snc/web` build clean.

## Review (2026-06-13)

**Verdict**: Approve with comments (deep lane, fresh-context sub-agent — not
cross-model) — feature and stories HELD at review on the fix-verify loopback.

**Blockers**: none
**Important**: (1) .pendingFrame/.collapsedOverlay positioning conflict — fixed
in-review (one-line composition guard in global-player.tsx; scoped tests green).
(2) chat-states acceptance boxes were unticked at review — ticked after verification.
**Nits**: four test-coverage gaps (retry key-bump, audio class absence, channel-switch
reset, rooms-fetch failure branch) accepted as-is; drive-by unicode-escape→literal
swaps and dead-var cleanup harmless; viewer-count aria-label on a bare span matches the
filed fix direction but may need visually-hidden text if AT testing shows it silent.

**Notes**: design conformance verified item-by-item with no silent omissions; the
audit's handled-well states (moderation banners, reconnect indicator, 3-miss poll
dismissal) confirmed intact; timed-out/banned tests correctly re-grounded to a
signed-in user so they still exercise the real input. Closes when the user fix-verifies
in the app.

## Fix-verify rollup (2026-06-13)
All three children resolved: chat-states (anon-gate + empty-chat walked live),
offline-loading (skeleton live + offline branch tested/architecturally-rare),
player-skeleton (cold-load live + error branch tested, forced-error deferred to staging).
Feature closed. Honest residue: the HLS-error overlay and the offline placeholder were
not live-walked in a browser — the first needs a forced mid-play error, the second is
unreachable under healthy S/NC TV auto-playout; both are unit-tested.
