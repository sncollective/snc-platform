---
id: live-experience-redesign-layout-ergonomics-mobile-tabs
kind: story
stage: review
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
