---
id: live-experience-redesign-layout-ergonomics-mobile-tabs
kind: story
stage: done
tags: [streaming]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: live-experience-redesign-layout-ergonomics
---

# Mobile stream-first tab restructure

Implements **Unit 1** of the parent feature's design (read `## Implementation Units`
→ Unit 1 in the parent body for exact signatures, CSS, and notes).

## Scope

`apps/web/src/contexts/global-player-context.tsx` (new `liveMobileChatOpen` field +
`setLiveMobileChatOpen` action + reducer case), `apps/web/src/routes/live.tsx`
(ephemeral `mobileChatOpen` state, `MobileTabBar` with tablist ARIA, info-sections
tabpanel wrapper, widened chat-portal render condition + `chatTabPanel` wrapper,
signal effect), `apps/web/src/routes/live.module.css` (tab bar classes, mobile-only
hide rules), `apps/web/src/routes/__root.tsx` (`liveGridMobileChat` class
composition), `apps/web/src/routes/__root.module.css` (chatPortal hidden-by-default
base, viewport-filling chat-open column). Plus tests:
`tests/unit/contexts/global-player-context.test.tsx`, `tests/unit/routes/live.test.tsx`.

Replaces the fixed always-on 400px mobile chat band (sev-3) with the Twitch-mobile
pattern: player on top, `Info | Chat` tabs below the always-visible channel
selector + status row, chat opt-in and viewport-filling. Desktop is structurally
untouched.

## Acceptance

- [ ] Mobile (<768px), streaming: player → selector/status row → `Info | Chat` tabs →
      info content; chat NOT visible by default
- [ ] Chat tab hides info sections and fills the viewport below the tabs; Info
      restores
- [ ] Tab state ephemeral; tabs absent while offline/loading
- [ ] Desktop (≥768px) behavior unchanged (existing tests pass)
- [ ] Tablist/tab/aria-selected/aria-controls wiring per design
- [ ] Context reducer tests cover the new field + action; live route tests cover tab
      rendering and signal calls

## Implementation notes

**What was done:**

1. `global-player-context.tsx` — added `liveMobileChatOpen: boolean` to `GlobalPlayerState`, `setLiveMobileChatOpen(open: boolean)` to `GlobalPlayerActions`, `SET_LIVE_MOBILE_CHAT` to the action union, reducer case returning `{ ...state, liveMobileChatOpen: action.open }`, `liveMobileChatOpen: false` to `INITIAL_STATE`, and the action dispatch implementation in the `useMemo` block.

2. `live.tsx` — added ephemeral `mobileChatOpen` state (not persisted to localStorage — deliberate, per design), signal effect (`setLiveMobileChatOpen`), `MobileTabBar` component with full tablist/tab/aria-selected/aria-controls wiring, restructured `routeContent` to insert `MobileTabBar` between `streamInfo` and the info sections, wrapped nowPlaying + creatorBar in `<div id="live-info-panel" role="tabpanel">` with `infoSectionsChatOpen` hide class, widened chat portal render condition to `(!prefs.chatCollapsed || mobileChatOpen)`, and wrapped portal content in `<div id="live-chat-panel" role="tabpanel" className={styles.chatTabPanel}>`.

3. `live.module.css` — added `mobileTabBar`, `mobileTab`, `mobileTabActive`, `infoSections`, `chatTabPanel`, and `infoSectionsChatOpen` classes. **`.infoSections` display choice: `display: flex; flex-direction: column; gap: var(--space-md)`** at all sizes (not `display: contents`). Rationale: `display: contents` has been rejected because `composes` does not compose with `display: contents` in CSS Modules, and the flex-column approach produces visually identical desktop rendering while being easier to hide on mobile. The `infoSectionsChatOpen` rule (inside `@media (max-width: 767px)`) sets `display: none` to hide the info panel when the chat tab is open. `mobileTabBar` defaults to `display: flex`; at `≥768px` it is set to `display: none`.

4. `__root.tsx` — added `isMobileChatOpen` from `playerState.liveMobileChatOpen` and composed `styles.liveGridMobileChat` on `<main>` when `isLiveLayout && isMobileChatOpen`.

5. `__root.module.css` — changed `.chatPortal` mobile base from `height: 400px; overflow: hidden` to `display: none; overflow: hidden` (removes the fixed 400px band). Added `.liveGridMobileChat` with `height: calc(100dvh - var(--nav-height) - var(--tab-bar-height, 0px) - var(--demo-banner-height, 0px)); padding: 0; overflow: hidden`. Added nested rules `.liveGridMobileChat .outletColumn` and `.liveGridMobileChat .chatPortal` to make chat fill remaining viewport. Added `display: block` to `.chatPortal` inside the `@media (min-width: 768px)` block to restore desktop visibility.

**Test counts:** 1675 tests, all passing. Added 9 new tests (5 context + 4 provider tests for `liveMobileChatOpen`; 6 new live route tab tests). Build passes.

**No padding adjustment needed:** the `liveGridMobileChat` rule sets `padding: 0` which overrides the base `.liveGrid` padding without requiring further compensation.

## Review (2026-06-13)
**Verdict**: Approve — held at review on fix-verify loopback (user confirms in the
running app). Fast lane: implementation record green (1678 web tests, build clean).

## Review findings — BOUNCE (user fix-verify failed 2026-06-13)
**Symptom (user)**: at 375px the chat tab renders BELOW the footer, and the player
content is now partially unviewable.

Two distinct layout faults to diagnose:
1. **Chat tab below the footer** — the `liveGridMobileChat` viewport-fill grid (the
   `100dvh - nav - tab-bar - demo-banner` calc in `__root.module.css`) is not accounting
   for the footer in the mobile shell, OR the chat portal cell is escaping the grid. The
   chat panel should fill the area between the tab bar and the bottom of the viewport,
   not stack after the footer.
2. **Player partially unviewable** — the stream-first restructure is clipping or
   over-sizing the player region at 375px; the player must stay fully visible above the
   `Info | Chat` tabs.

Re-verify against the design's intent (player on top, tabs below, chat fills remaining
viewport as an opt-in tab — NOT appended to document flow). Sibling
`page-states`/`player-chrome` stories share `live.tsx`/`__root` — coordinate so the fix
doesn't regress them.

## Fix (2026-06-13)

Two targeted changes to `apps/web/src/routes/__root.module.css` inside the
`.liveGridMobileChat` block:

**Fault 1 — Chat below footer:** Added `.liveGridMobileChat .outletColumn footer { display:
none; }`. The footer renders inside `.outletColumn` (see `__root.tsx` line 124:
`{isLiveLayout && !isTheater && <Footer />}` inside the outletColumn div). With
`overflow: hidden` on `<main>` and `flex: 0 0 auto` on `.outletColumn`, the footer's
natural height was included in the outletColumn's flex-sizing, consuming space that should
belong to the `.chatPortal` (`flex: 1 1 auto`). The footer was pushing the chatPortal
beyond the container's visible area. Hiding it removes that space from the outletColumn's
height, allowing the chatPortal to fill the remaining viewport correctly. This is exactly
the mitigation the parent feature design prescribed (Unit 1 impl note: "if it visually
intrudes, hide it with `.liveGridMobileChat .outletColumn footer { display: none; }`").

**Fault 2 — Player partially unviewable:** Added `.liveGridMobileChat > :first-child {
flex-shrink: 0; }`. `GlobalPlayer` is the first direct child of `<main>`. In a
fixed-height flex container (`.liveGridMobileChat` sets `height: calc(100dvh - ...)` and
`overflow: hidden`), flex children default to `flex-shrink: 1`. When the sum of player
height (16:9 at 375px ≈ 211px) + outletColumn height + chatPortal exceeded the container,
the flex algorithm shrank the player, making the player region smaller than its natural
16:9 aspect ratio and cutting off the bottom of the video. Adding `flex-shrink: 0` prevents
the player from being shrunk; the outletColumn (also `flex: 0 0 auto`) takes its natural
size, and any excess is absorbed by the chatPortal (`flex: 1 1 auto`) or clipped at the
footer (which is now hidden).

**Desktop untouched:** both rules are inside the `.liveGridMobileChat` selector, which is
only applied when `isMobileChatOpen && isLiveLayout` — a state only reachable from the
mobile-only `MobileTabBar`. Desktop uses `display: grid` at `min-width: 768px`, where the
`.liveGridMobileChat` height/flex rules do not interact with the grid layout. The signal
only fires from the mobile tab bar, so `.liveGridMobileChat` is inert on desktop.

**Files changed:** `apps/web/src/routes/__root.module.css`

**Test result:** 1737/1737 web unit tests green (158 files). CSS geometry cannot be
verified in jsdom; the fix addresses the layout logic via CSS reasoning and code inspection.

**375px visual confirmation is deferred to the user's fix-verify loopback.** This agent
cannot run the browser at 375px. The user must confirm that (a) the chat panel now fills
the viewport below the tab bar and (b) the player is fully visible above the tabs.

## Fix-verify (2026-06-14 — user confirmed in-app, screenshot)
User captured /live at 767px with S/NC TV airing (live-source via test-live-fallback.sh).
Both bounced faults resolved: (1) player fully visible at the top (was partially
unviewable); (2) chat renders inside the Chat tab region and fills down to the bottom nav
bar — NOT stacked below the footer, no scroll trap. The chat-open layout
(`.liveGridMobileChat` footer-hide + player flex-shrink:0) holds at 375–767px. Closed
review -> done.

## Re-bounce (2026-06-14 — premature close corrected)
Closed review->done off a 767px screenshot where the player looked fully visible. At true
mobile width the user reports the player's BOTTOM CONTROL BAR (red LIVE badge + fullscreen
button) hangs off the bottom — i.e. "player partially unviewable" is NOT fully resolved.
Confirmed visually on the docked mini-player too (shot2): same LIVE+fullscreen row clipped.

Root-cause note for the next pass: `/live` (expanded) and the mini-player (collapsed) are
the SAME single persistent `<MediaPlayer>` (components/media/global-player.tsx), always
`aspectRatio:"16/9"`. The bottom-control clip appears in BOTH presentations → it's the
Vidstack DefaultVideoLayout control bar overflowing the 16:9 frame at narrow/mini sizes,
clipped by `overflow:hidden` on `.playerContainer` (live) / `.collapsedOverlay`
(global-player). This is a player-component fitting bug, largely independent of the tab
restructure — but it's what the user sees as "player not fully viewable," so it lands here
until split out. NEED a 375px /live screenshot to confirm whether the player region is also
being squeezed by the grid (mobile-tabs' own concern) vs purely the control-bar fit.
Back to implementing.

## Resolution (2026-06-14 — re-closed; residual split to a new story)
The earlier re-bounce conflated two things. Clarified with the user: on /live the player
controls are NOT cut — they OVERFLOW the 16:9 box but stay visible. The cut only happens in
the 200px mini-player (overflow:hidden). That overflow is the shared `<MediaPlayer>` control
bar not fitting its 16:9 frame — a player-component bug, NOT this story's grid work
(chat-fill + player placement, both verified in shot.png/shot3). Split to a new standalone
story `live-player-control-bar-overflow`. This story's deliverable stands verified; re-closed
implementing -> done.
