---
id: a11y-viewer-chat-input-focus-ring
kind: backlog
tags: [streaming, accessibility]
created: 2026-06-12
---

# WCAG: Chat input removes focus ring

## Violation

`apps/web/src/components/chat/chat-panel.module.css` line 203–206 removes the focus ring on
the chat message input:

```css
.input:focus {
  outline: none;
  border-color: var(--color-primary);
}
```

`outline: none` suppresses the browser default focus indicator. The border-color change
provides a weak substitute (color-only, no shape change) that may not meet contrast
requirements for all users and does not provide the distinct shape contrast required by
WCAG 2.2.

## WCAG Criterion

**2.4.11 Focus Appearance (Minimum)** (Level AA, WCAG 2.2): Focus indicator must have a
minimum area equal to a 2px perimeter, and sufficient contrast ratio between focused and
unfocused states.

The `outline: none` rule unconditionally removes the indicator. The `border-color` change
provides only a color difference and may be insufficient in high-contrast or forced-color
modes where CSS border colors are overridden by user agents.

## File and Line

`apps/web/src/components/chat/chat-panel.module.css:203`

## Severity

2 (minor — affects keyboard users; workaround exists via the border color shift, but it
does not meet the full WCAG 2.4.11 specification).

## Fix direction

Replace `outline: none` with `outline: 2px solid var(--color-primary); outline-offset: -2px`
to match the pattern already used in `.userListToggle:focus-visible` in the same file
(line 77–80), which correctly uses an inset focus ring.
