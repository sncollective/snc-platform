---
tags: [ux-polish]
release_binding: null
created: 2026-04-21
---

# chat user-list toggle focus indicator tuning

The current inset outline (added 2026-04-21 to prevent clipping by .panel's overflow: hidden) sits flush against full-width button edges and reads a bit tight. Tune visually — candidates: background-color change on :focus-visible instead of an outline, or inner padding so the inset ring breathes, or switching .panel to overflow: clip so a standard offset outline works. Surfaced in /review of chat-presence 2026-04-21 (Finding: "Can't tab to Show users" resolved, polish remains).
