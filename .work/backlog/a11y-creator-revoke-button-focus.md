---
id: a11y-creator-revoke-button-focus
kind: backlog
tags: [streaming, creators, accessibility]
created: 2026-06-12
---

# A11y: "Revoke" button has no visible keyboard focus indicator (WCAG 2.4.7)

## Violation

WCAG 2.2 SC 2.4.7 Focus Visible — AA

The `.revokeButton` class in `streaming.module.css` defines only color, background, border, cursor, and padding — no `:focus` or `:focus-visible` rule. The browser default outline is suppressed globally (computed `outline: none`). Keyboard users tabbing to the "Revoke" button see no visible focus ring.

## File and line

`apps/web/src/routes/creators/$creatorId/manage/streaming.module.css:68–78` — `.revokeButton` definition has no focus rule.

## Fix

Add:
```css
.revokeButton:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

## Severity

3 (major) — keyboard-only users cannot identify which element has focus before triggering a destructive irreversible action.
