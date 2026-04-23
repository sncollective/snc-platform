---
id: story-theater-mode-tab-bar-hide
kind: story
stage: implementing
tags: [ux-polish, streaming]
release_binding: null
created: 2026-04-20
updated: 2026-04-23
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

- [ ] Locate the theater-mode state holder on the `/live` page and the tab-bar component.
- [ ] Subscribe the tab-bar component to theater state; suppress render (or apply `hidden` class) while theater is active.
- [ ] Wire `Escape` key to exit theater (alongside second `t` and button).
- [ ] Verify restore on exit: no scroll jump, no layout flash, tab bar returns in-place.

## Risks

Low. Additive suppression of an existing chrome element; no state-machine changes.
