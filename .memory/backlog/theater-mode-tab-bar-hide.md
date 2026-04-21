---
tags: [ux-polish, streaming]
release_binding: null
created: 2026-04-20
updated: 2026-04-21
---

# Theater Mode Tab Bar Hide

Hide the bottom tab bar when the user is in theater mode on the /live page to provide an immersive viewing experience. The tab bar should be suppressed for the duration of theater mode and restored when the user exits.

## Pattern references

See [live-streaming-ux-patterns.md §1.1 Desktop layout modes](../research/live-streaming-ux-patterns.md):

- **Theater mode** — expanded-width player with chat retained; dark background to reduce chrome glare; immersive intent. Page chrome outside the player + chat should yield: nav, footers, tab bars all suppress while theater is active. Fullscreen mode goes further (chat also hides), but theater stays one notch back.
- **Persistence** — theater toggle state persists in localStorage per Twitch convention (survives page reload).
- **Keyboard shortcut `t`** — standard across Twitch/YouTube (via extension on the latter). Hiding the tab bar as a side effect of `t` aligns with the established muscle memory.

## Scoping notes

- Small; likely inline-implementable. Theater-mode state is already maintained somewhere on the player — extend subscribers to suppress tab bar.
- Verify: exiting theater (second `t`, or click button) restores tab bar in-place without scroll jump or layout flash.
- Consider: does `Escape` also exit theater? Research doesn't canonicalize this, but it's a consistent expectation.
