---
id: bug-connect-button-missing-style
kind: backlog
tags: [streaming, creators]
created: 2026-06-12
---

# Bug: ConnectButton renders with no CSS styling (missing .secondaryButton in button.module.css)

## Description

The `ConnectButton` component in `apps/web/src/routes/creators/$creatorId/manage/streaming.tsx` passes `buttonStyles.secondaryButton` as the button's `className`:

```tsx
// streaming.tsx line 76
className={buttonStyles.secondaryButton}
```

`buttonStyles` is imported from `apps/web/src/styles/button.module.css`. However, `button.module.css` defines only `.primaryButton` and `.primaryButtonLink` — there is no `.secondaryButton` class. CSS Modules returns `undefined` for missing keys; React renders `className=""`.

## Observed behavior

Both "Connect Twitch" and "Connect YouTube" buttons render with:
- `className=""` (no CSS applied)
- `height: 19px` (text line-height only)
- `padding: 0px`
- No visible button affordance

## Expected behavior

Buttons should look like secondary-style buttons (border + transparent background) matching the platform's design system.

## Fix

Add `.secondaryButton` to `apps/web/src/styles/button.module.css`. The definition should match the existing pattern in `error-page.module.css`:

```css
.secondaryButton {
  padding: var(--space-sm) var(--space-lg);
  background: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-ui);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
}
.secondaryButton:hover {
  background: var(--color-surface-hover);
}
.secondaryButton:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

## Evidence

`.memory/scratchpad/streaming-playout-ux-review/creator-desktop-c1-connect-section.png`
`.memory/scratchpad/streaming-playout-ux-review/creator-mobile-c1-connect-buttons.png`
