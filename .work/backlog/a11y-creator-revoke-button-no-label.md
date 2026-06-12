---
id: a11y-creator-revoke-button-no-label
kind: backlog
tags: [streaming, creators, accessibility]
created: 2026-06-12
---

# A11y: "Revoke" buttons lack accessible names identifying which key they operate on (WCAG 2.4.6 / 4.1.2)

## Violation

WCAG 2.2 SC 4.1.2 Name, Role, Value — A (hard requirement)
WCAG 2.2 SC 2.4.6 Headings and Labels — AA

When a creator has multiple stream keys, each key row renders a "Revoke" button. All "Revoke" buttons have identical accessible names. Screen readers announce them all as "Revoke, button" with no way to distinguish which key each operates on.

## Root cause

`apps/web/src/routes/creators/$creatorId/manage/streaming.tsx:241`:
```tsx
<button
  type="button"
  className={styles.revokeButton}
  onClick={() => handleRevoke(key.id, key.name)}
>
  Revoke
</button>
```

No `aria-label`, `aria-describedby`, or visually-hidden text identifying the key name.

## Fix

Add `aria-label={`Revoke key "${key.name}"`}` to the button, or wrap in an `aria-label` with the key name in the accessible name computation.

## Severity

2 (minor at single-key scale; escalates to major with multiple keys).

## Evidence

`.memory/scratchpad/streaming-playout-ux-review/creator-desktop-c2-before-revoke.png`
