---
id: feature-live-page-controls-hover
kind: feature
stage: done
tags: [streaming, ux-polish]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-21
related_decisions: []
related_designs: []
parent: null
---

# Live Page Controls Hover Behavior

## Scope

Bug-fix redesign for control visibility, positioning, and chat-toggle unification *within the existing site-width /live layout*. The research `../../research/live-streaming-ux-patterns.md` commits to a wider layout-modes model (theater = near-full-width player + dark background; fullscreen and PiP as peer modes) that this build doesn't adopt — the underlying "does /live get site-width chrome or full-bleed chrome" question is parked as `../../backlog/live-page-layout-chrome-decision.md` for later resolution. Research-aligned rework is deferred to a follow-on feature bound to 0.3.1+.

**In scope:**

- Controls (theater toggle, chat toggle tab, theater overlay) fade in on mouse/touch activity and auto-hide after 2s/3s idle.
- Hover detection via window-level `mousemove`/`touchstart` listeners (the player is rendered at root-grid level outside this route's JSX tree, so a route-scoped element can't cover the player region).
- Unified chat collapse/expand button at the top-right of the player — same position whether chat is visible or collapsed; `→`/`←` icon toggles. Replaces the inline collapse button that lived in `ChatPanel`'s tab bar.
- Theater toggle adjacent to the chat toggle, always to its left. Single `×` exit path in theater mode (the separate "Exit Theater" button on the overlay was removed as redundant).
- Grid-cascade fix in `__root.module.css` so `chatCollapsed` actually reclaims the 340px chat column for the player at desktop.
- Theater-mode top anchoring: both buttons move up to `var(--space-sm)` from viewport top since nav is hidden in theater mode (`!isTheater && <NavBar />`).
- Theater overlay stripped to passive info (`pointer-events: none`) so clicks pass through to the theater toggle underneath.

**Explicitly out of scope (subsumed by `live-page-layout-chrome-decision`):**

- Theater-as-near-full-width (research §1.1) — depends on layout-chrome decision
- Dark-background treatment in theater (research §1.1)
- Fullscreen as a peer mode with its own controls (research §1.1, §1.3)
- PiP / mini-player as a third peer mode (research §1.1)
- Avatar-top-right + compressed-nav-top-left Twitch-shape chrome
- Controls popping off the player at small widths (under a separate review track)

---

## Design Overview

Two CSS-only fixes against the existing site-width /live layout and the existing `controlsVisible` state plumbing. No JSX changes — the prior implementation wired React state, effect cleanup, `clsx` classes, and the `TheaterOverlay` `visible` prop correctly. The regressions were all downstream: a missing `.controlVisible` rule in [live.module.css](../../../apps/web/src/routes/live.module.css), and a CSS cascade bug in [__root.module.css](../../../apps/web/src/routes/__root.module.css) that neutralizes `.liveGridChatCollapsed` at desktop.

The cascade bug deserves a note because it disguised as Finding 3 *and* Finding 2. At `@media (min-width: 768px)`, `.liveGrid { grid-template-columns: 1fr 340px }` (line 61) overrides the earlier `.liveGridChatCollapsed { grid-template-columns: 1fr }` (line 49) due to equal specificity + later source order. Moving the collapsed rule *inside* the media query makes it win. Once the grid actually rebalances, the existing `.theaterToggleCollapsed { right: var(--space-sm) }` correctly lands on the player's new right edge — so the "toggle drifts off the player" symptom disappears as a side-effect. No new positioning math needed.

The vertical-center behavior (`top: 50%` viewport-relative) is not redesigned here — it's slightly off-center relative to the player column but was not the user's primary concern, and player-container-relative anchoring would require moving the toggle's DOM location through the global-player-context. Deferred to the [layout-chrome-decision](../../backlog/live-page-layout-chrome-decision.md) follow-on scope.

## Implementation Units

### Unit 1: Add `.controlVisible` CSS block

**File:** `platform/apps/web/src/routes/live.module.css`

Add an empty `.controlVisible` class (so the CSS module exports the symbol and `styles.controlVisible` resolves at runtime) plus `opacity: 0` + `transition` defaults on `.theaterToggle` and `.chatExpandTab`, plus the `.controlVisible`-combined rule. The existing `.theaterOverlay` / `.theaterOverlayVisible` pair already handles the overlay and stays as-is; keep the overlay's `:hover` fallback rule intact since the JSX still reaches the overlay with both the class and the prop.

Concretely, at an appropriate place after `.theaterToggle` and `.chatExpandTab` are defined:

```css
/* ── Control visibility (fade shared across theater toggle + chat expand tab) ── */

.controlVisible {
  /* Marker class so live.module.css exports styles.controlVisible.
     Combined rules below drive opacity + pointer-events. */
}

.theaterToggle,
.chatExpandTab {
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.theaterToggle.controlVisible,
.chatExpandTab.controlVisible {
  opacity: 1;
  pointer-events: auto;
}
```

**Implementation notes:**
- Place after the existing `.theaterToggleCollapsed` / `.chatExpandTab:hover` rules and before the `@media (min-width: 768px)` block so desktop `display: flex` overrides still apply to the hidden (opacity: 0) buttons — the buttons render in layout but invisible + non-interactive.
- Don't touch `.theaterToggleActive` — it composes `theaterToggle` and still works under the new defaults (opacity is independent of the composes chain).
- Don't touch `.theaterOverlay` — it already has `opacity: 0; transition; pointer-events: none` and the `.theaterOverlayVisible` class that the JSX is already applying (see [live.tsx:382](../../../apps/web/src/routes/live.tsx#L382)).

**Acceptance criteria:**
- [ ] On a live stream, `.theaterToggle` is invisible + non-interactive by default (page load with no mouse activity).
- [ ] Mouse movement over `.routeContent` makes the toggle fade in over ~0.2s.
- [ ] After 2s of mouse inactivity, the toggle fades out over ~0.2s.
- [ ] Mouse leaving `.routeContent` immediately hides the toggle.
- [ ] Same behavior for `.chatExpandTab` when `prefs.chatCollapsed` is true.
- [ ] Hidden toggle/tab do not receive clicks (pointer-events: none while faded).

### Unit 2: Fix `.liveGridChatCollapsed` cascade bug

**File:** `platform/apps/web/src/routes/__root.module.css`

Move the `.liveGridChatCollapsed` rule (currently lines 48–54) *inside* the `@media (min-width: 768px)` block so it wins the cascade against `.liveGrid { grid-template-columns: 1fr 340px }` on line 61. The `.liveGridChatCollapsed .chatPortal { display: none }` rule belongs inside the media query too — at mobile, the whole grid is flex-column and chat simply stacks below, so the collapse behavior at mobile works via the existing flex flow (the chat portal hides via `display: none` regardless, which is fine).

Post-fix shape:

```css
@media (min-width: 768px) {
  .liveGrid {
    display: grid;
    grid-template-columns: 1fr 340px;
    grid-template-rows: auto 1fr;
    height: calc(100vh - var(--nav-height));
    max-width: none;
    padding: 0 0 0 var(--space-xl);
    margin: 0;
    overflow: hidden;
  }

  .chatPortal {
    grid-column: 2;
    grid-row: 1 / -1;
    border-left: 1px solid var(--color-border);
    border-top: none;
    height: auto;
  }

  .liveGridChatCollapsed {
    grid-template-columns: 1fr;
  }

  .liveGridChatCollapsed .chatPortal {
    display: none;
  }
}
```

Remove the out-of-@media duplicates at current lines 48–54.

**Implementation notes:**
- The mobile path (base `.liveGrid` as `display: flex; flex-direction: column`) already handles chat collapse via the hidden `.chatPortalHidden` class on the chat portal div (see root `__root.tsx`). Moving `.liveGridChatCollapsed .chatPortal { display: none }` inside the media query does not regress mobile because mobile doesn't use the `.liveGridChatCollapsed` class-driven hide at all — it uses its own flex-flow stacking. Verify by toggling collapse on mobile emulation after the change.
- `.liveGridTheater { height: 100vh; padding-left: 0 }` (lines 41–44) is orthogonal and stays where it is — it handles the theater flag, not the chat flag.

**Acceptance criteria:**
- [ ] On desktop (≥768px), with a live stream selected and chat collapsed, the player column fills the full width of `.liveGrid` (no 340px ghost column on the right).
- [ ] On desktop, with chat expanded, the grid remains `1fr 340px` (no regression).
- [ ] On mobile (<768px), chat collapse behavior is unchanged (chat stacks below via flex; `.chatPortalHidden` hides it).
- [ ] In theater mode + chat collapsed, the player fills full viewport width.
- [ ] In theater mode + chat expanded, layout is unchanged from current.

## Implementation Order

1. **Unit 1** first — self-contained CSS addition in [live.module.css](../../../apps/web/src/routes/live.module.css), low risk. User can verify fade behavior immediately.
2. **Unit 2** second — CSS cascade fix in [__root.module.css](../../../apps/web/src/routes/__root.module.css). Touches the root grid so merits more attention on verification (desktop + mobile + theater + chat-collapse permutations).

Both are independent; either order works. Listed in user-visible-impact order.

## Test Strategy

No automated tests. Both units are CSS-only visual/layout changes best verified manually against the running dev env:

1. `bun run --filter @snc/web build` — confirm no build regressions.
2. `pm2 restart web` — reload dev server.
3. Manual verification against [live-page-controls-hover.md](live-page-controls-hover.md) Unit 1 + Unit 2 acceptance criteria (above). User-driven session during the next `/review` pass.

No vitest unit coverage is warranted — there's no JS logic to test (plumbing already landed + tested implicitly via the existing feature shape; the fix is downstream CSS). No Playwright coverage — the /live route is outside the golden-path e2e surface today.

## Verification Checklist

```bash
bun run --filter @snc/web build
pm2 restart web
```

Then in a browser against `http://localhost:3082/live` (staging) or equivalent dev web port:

- [ ] Load /live with an active channel; mouse-still → theater toggle invisible.
- [ ] Move mouse → toggle fades in over ~0.2s. Stop moving → fades out after 2s.
- [ ] Leave `.routeContent` with mouse → toggle hides immediately.
- [ ] Click toggle → theater mode engages; overlay appears on hover; toggle shows `×` to exit.
- [ ] Collapse chat (via ChatPanel's collapse button) → player fills chat's former 340px. Chat-expand tab (`←`) appears fades-with-hover in the top-right.
- [ ] Click chat-expand tab → chat returns, grid returns to `1fr 340px`.
- [ ] Theater + chat-collapsed → player fills full viewport width; theater toggle sits at player's right edge (not drifted).
- [ ] Touch emulation on mobile Chrome DevTools (Pixel 8, 915×412 landscape, ≥768px) → tap content area shows controls for 3s; chat collapse expands player.
- [ ] Mobile <768px → toggle + chat-expand tab hidden by `display: none` as before (no regression).

## Inline tasks

Both units are task-sized CSS edits. No child stories needed.

- [x] **Task 1** — Add `.controlVisible` + opacity defaults to `live.module.css` per Unit 1.
- [x] **Task 2** — Move `.liveGridChatCollapsed` rules inside the `@media (min-width: 768px)` block of `__root.module.css` per Unit 2.
- [x] **Task 3** — Run `bun run --filter @snc/web build`; restart `web` pm2 process; confirm no type/lint regressions.
