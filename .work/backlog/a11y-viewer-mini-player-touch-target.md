---
id: a11y-viewer-mini-player-touch-target
kind: backlog
tags: [streaming, accessibility]
created: 2026-06-12
---

# WCAG: Mini-player action buttons below minimum touch target size

## Violation

The collapsed GlobalPlayer's expand (↗) and close (✕) buttons are 24×24px:

```css
/* apps/web/src/components/media/global-player.module.css lines 79-93 */
.expandButton,
.closeButton {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  ...
}
```

24×24px is below the WCAG 2.5.5 recommended 44×44px and below the WCAG 2.5.8 minimum
target size of 24×24px (the absolute minimum, but only if there is 24px spacing around it).
In the mini-player these two buttons are spaced 4px apart (`gap: 4px` in `.collapsedActions`),
which means the 24px spacing requirement for 2.5.8 exception is not met.

On mobile the mini-player is 200×113px, making the 24×24px buttons ~12% of the player
height — difficult to tap accurately while the video plays.

## WCAG Criterion

**2.5.5 Target Size (Enhanced)** (Level AAA — recommended minimum 44×44px)
**2.5.8 Target Size (Minimum)** (Level AA, WCAG 2.2) — 24×24px allowed only with 24px
spacing around the target; the 4px gap between buttons does not satisfy this exception.

## File and Line

`apps/web/src/components/media/global-player.module.css:79`

## Severity

3 (major on mobile — the two critical actions on the mini-player are undersized on the
primary mobile use case; expand and close errors result in accidentally starting/stopping
playback or navigating away unintentionally).

## Fix direction

Increase `width` and `height` to `44px` for both buttons (or use `padding` to expand the
tap area without changing visual size: `padding: 10px` with `width: 24px; height: 24px`).
On desktop the visual 24px circle can be preserved using a transparent padding zone.
