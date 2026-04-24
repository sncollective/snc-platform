---
id: story-theater-mode-tab-bar-hide
kind: story
stage: done
tags: [ux-polish, streaming]
release_binding: 0.3.0
created: 2026-04-20
updated: 2026-04-24
related_decisions: []
related_designs: [.memory/research/live-streaming-ux-patterns.md]
parent: null
---

Hide the bottom tab bar when the user is in theater mode on the `/live` page to provide an immersive viewing experience. Tab bar suppresses for the duration of theater mode and restores on exit.

## Pattern references

See [live-streaming-ux-patterns.md §1.1 Desktop layout modes](../../research/live-streaming-ux-patterns.md):

- **Theater mode** — expanded-width player with chat retained; dark background to reduce chrome glare; immersive intent. Page chrome outside the player + chat should yield: nav, footers, tab bars all suppress while theater is active. Fullscreen mode goes further (chat also hides), but theater stays one notch back.
- **Persistence** — theater toggle state persists in localStorage per Twitch convention (survives page reload).
- **Keyboard shortcut `t`** — standard across Twitch/YouTube. Hiding the tab bar as a side effect of `t` aligns with the established muscle memory.

## Approach

Theater-mode state is already maintained on the player. Extend subscribers so the tab-bar component suppresses while theater is active. Small; likely inline-implementable.

**Escape exits theater** — pinned decision. Matches YouTube / browser-fullscreen muscle memory. Second `t`, Escape, and the explicit button are all valid exit paths.

## Tasks

- [x] Locate the theater-mode state holder on the `/live` page and the tab-bar component.
- [x] Subscribe the tab-bar component to theater state; suppress render (or apply `hidden` class) while theater is active.
- [x] Wire `Escape` key to exit theater (alongside second `t` and button).
- [x] Verify restore on exit: no scroll jump, no layout flash, tab bar returns in-place.

## What shipped

**Tab bar suppression** — `AppShell` (in `routes/__root.tsx`) already subscribed to `playerState.liveLayout` via the global player context and computed `isTheater = playerState.liveLayout === "theater"`. `<NavBar>` was already guarded by `!isTheater`, but `<BottomTabBar />` was rendered unconditionally. Change: wrap it in the same guard.

```tsx
// before
<BottomTabBar />

// after
{!isTheater && <BottomTabBar />}
```

**Escape-to-exit** — extended the existing keyboard shortcut effect in `routes/live.tsx` (which already handled `t`) to also handle `Escape` when theater is active. Kept within the same `useEffect` so input-field early-return logic and streaming-gate both apply.

```ts
if (e.key === "Escape" && prefs.theater) {
  updatePrefs({ theater: false });
}
```

Escape only fires when `prefs.theater` is already true — no behavior change outside theater mode. Event is not stopped from propagating; any open modal listeners will still receive Escape.

Files touched:
- `apps/web/src/routes/__root.tsx` — wrap `<BottomTabBar />` in `!isTheater` check
- `apps/web/src/routes/live.tsx` — add Escape case to the existing `t` keyboard handler, rename comment

## Risks

Low. Additive suppression of an existing chrome element using the same pattern NavBar already uses; no state-machine changes, no new global state.

**Edge case — Escape while a modal is open in theater mode:** both the modal's Escape handler and the theater-exit handler will fire. Net effect: modal closes AND theater exits. Arguably correct UX ("user pressed Escape, things closed"), but worth flagging. If this proves disruptive in practice, wrap the exit in a `document.querySelector('[role="dialog"]')` check.

## Verification

- [x] Unit tests pass — full web suite (151 files, 1600 tests) green.
- [ ] **Browser verification pending** — enter `/live`, start streaming a channel, toggle theater via `t`: tab bar disappears, NavBar disappears (already did), player expands. Press Escape: theater exits, tab bar returns without scroll jump. Toggle theater again, click the explicit button to exit: same clean restore. Mobile breakpoint: bottom tab bar is a mobile-only element (`@media max-width: 768px` in CSS), so the visible test requires a narrow viewport. `/review`'s job.
