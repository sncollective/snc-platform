---
id: a11y-viewer-chat-input-focus-ring
kind: story
stage: review
tags: [streaming, accessibility]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-20
updated: 2026-06-20
---

# A11y: chat message input removes focus ring (WCAG 2.4.11)

Promoted from backlog (2026-06-12 streaming/playout UX review). The chat message input used
`.input:focus { outline: none; border-color: ... }` — `outline: none` unconditionally removed
the focus indicator, leaving only a color-difference cue that does not meet WCAG 2.4.11 Focus
Appearance (no shape contrast; fails under forced-colors/high-contrast where CSS border colors
are overridden).

## Fix

`apps/web/src/components/chat/chat-panel.module.css` — replaced the `.input:focus` rule with
`.input:focus-visible`, adding `outline: 2px solid var(--color-accent); outline-offset: -2px`
(inset, so it isn't clipped by `.panel`'s `overflow: hidden`) and keeping the border-color shift
as a secondary cue. Mirrors the existing `.userListToggle:focus-visible` pattern in the same
file. Switched `:focus` → `:focus-visible` so the ring shows for keyboard users without a click
outline on pointer focus.

## Verification

- Chat component suite green (29/29); CSS-only change, no logic touched.

## Fix-verify loopback (pending)

In the running app (any live stream with chat): Tab into the chat message input — a visible
2px focus ring appears around the field. Story stays at `stage: review` until confirmed.
