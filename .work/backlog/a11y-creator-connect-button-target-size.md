---
id: a11y-creator-connect-button-target-size
kind: backlog
tags: [streaming, creators, accessibility]
created: 2026-06-12
---

# A11y: Connect Twitch/YouTube buttons fail minimum touch target size (WCAG 2.5.8)

## Violation

WCAG 2.2 SC 2.5.8 Target Size (Minimum) — AA

The "Connect Twitch" and "Connect YouTube" buttons on the creator streaming manage page (`/creators/:id/manage/streaming`) render with height=19px and padding=0px, far below the 24×24 CSS pixel minimum.

## Root cause

`ConnectButton` component (`streaming.tsx` line 76) passes `buttonStyles.secondaryButton` as `className`, but `.secondaryButton` is not defined in `apps/web/src/styles/button.module.css`. CSS Modules returns `undefined`; React renders `className=""`. The buttons receive zero styling — no padding, no border, no defined height.

## File and line

`apps/web/src/routes/creators/$creatorId/manage/streaming.tsx:76`
`apps/web/src/styles/button.module.css` (missing `.secondaryButton` definition)

## Severity

3 (major) — interactive control fails WCAG AA at both desktop and mobile viewports.

## Evidence

`.memory/scratchpad/streaming-playout-ux-review/creator-mobile-c1-connect-buttons.png`
