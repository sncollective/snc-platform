---
source_handle: vidstack-video-layout-css
fetched: 2026-06-14
source_path: node_modules/.bun/@vidstack+react@1.12.13+b2e33729a97476bf/node_modules/@vidstack/react/player/styles/default/layouts/video.css
provenance: source-direct
---

## Summary

The `video.css` file defines all layout-specific positioning, sizing, and spacing rules for the DefaultVideoLayout. It scopes all rules under `.vds-video-layout` and sub-selectors. It is where the negative margin offsets for the controls group are defined, and where `[data-sm]` vs `[data-lg]` variant rules are applied.

## Key passages

### Player-level background and border (selector: `[data-media-player][data-layout='video']` and `:not([data-fullscreen])`)

```css
[data-media-player][data-layout='video'] {
  background-color: var(--video-bg, black);
}

[data-media-player][data-layout='video']:not([data-fullscreen]) {
  border-radius: var(--video-border-radius, 6px);
  border: var(--video-border, 1px solid rgb(255 255 255 / 0.1));
}
```

Source-internal anchor: lines 11-18.

### Layout root CSS custom property declarations (selector: `:where(.vds-video-layout)`)

```css
:where(.vds-video-layout) {
  --media-brand: var(--video-brand, #f5f5f5);
  --media-font-family: var(--video-font-family, sans-serif);
  --media-controls-color: var(--video-controls-color, #f5f5f5);
  --media-tooltip-y-offset: 6px;
  --media-menu-y-offset: 6px;
  --media-focus-ring-color: var(--video-focus-ring-color, rgb(78 156 246));
  --media-focus-ring: var(--video-focus-ring, 0 0 0 3px var(--media-focus-ring-color));
  color: var(--video-controls-color, #f5f5f5);
  display: contents;
}
```

Source-internal anchor: lines 20-30. These `--video-*` names are the public consumer hooks (they feed into internal `--media-*` properties).

### Controls gradient overlay (selector: `:where(.vds-video-layout .vds-controls[data-visible])`)

```css
:where(.vds-video-layout .vds-controls[data-visible]) {
  border-radius: var(--video-border-radius, 6px);
  background-image: linear-gradient(
    to top,
    rgb(0 0 0 / 0.6),
    10%,
    transparent,
    95%,
    rgb(0 0 0 / 0.3)
  );
}
```

Source-internal anchor: lines 43-53.

### Default controls-group padding (selector: `.vds-video-layout .vds-controls-group`)

```css
.vds-video-layout .vds-controls-group {
  align-items: center;
  display: flex;
  pointer-events: auto;
  z-index: 0;
  padding: 4px 6px;
}
```

Source-internal anchor: lines 55-61.

### First controls group z-index (selector: `.vds-video-layout .vds-controls-group:first-child`)

```css
.vds-video-layout .vds-controls-group:first-child {
  z-index: 50;
}
```

Source-internal anchor: lines 63-65.

### CRITICAL: Second-to-last group negative margin (selector: `.vds-video-layout .vds-controls-group:nth-last-child(2)`)

```css
/* second last group */
.vds-video-layout .vds-controls-group:nth-last-child(2) {
  padding: 0 12px;
  z-index: 11;
  margin-bottom: -16px;
}
```

Source-internal anchor: lines 67-72. This is the time-slider group. The `-16px` bottom margin pulls the slider group downward, overlapping with the bottom button row.

### Large layout last group z-index and tooltip/preview offsets (selector: `.vds-video-layout:not([data-sm]) .vds-controls-group:last-child`)

```css
.vds-video-layout:not([data-sm]) .vds-controls-group:last-child {
  --media-menu-y-offset: 26px;
  --media-tooltip-y-offset: 26px;
  --media-slider-preview-offset: 26px;
  z-index: 10;
}
```

Source-internal anchor: lines 74-79. The offsets push menus/tooltips upward to avoid being clipped by the slider-group overlap.

### Small layout second-to-last group (pointer-events off) (selector: `:where(.vds-video-layout[data-sm] .vds-controls-group:nth-last-child(2))`)

```css
:where(.vds-video-layout[data-sm] .vds-controls-group:nth-last-child(2)) {
  pointer-events: none;
}
```

Source-internal anchor: line 451-453.

### Small layout last group negative margins (selector: `:where(.vds-video-layout[data-sm] .vds-controls-group:last-child)`)

```css
:where(.vds-video-layout[data-sm] .vds-controls-group:last-child) {
  z-index: 2;
  margin-top: -2.5px;
  margin-bottom: -6px;
}
```

Source-internal anchor: lines 455-459.

### Small layout last group in fullscreen (selector: `:where([data-fullscreen] .vds-video-layout[data-sm] .vds-controls-group:last-child)`)

```css
:where([data-fullscreen] .vds-video-layout[data-sm] .vds-controls-group:last-child) {
  margin-bottom: 0;
}
```

Source-internal anchor: lines 461-463. Fullscreen resets the small layout bottom margin to zero.

### Small layout group padding override (selector: `.vds-video-layout[data-sm] .vds-controls-group`)

```css
.vds-video-layout[data-sm] .vds-controls-group {
  padding: 2px;
}
```

Source-internal anchor: lines 465-467.

### Fullscreen re-application of -16px offset (selector: `:where([data-fullscreen] .vds-video-layout .vds-controls-group:nth-last-child(2))`)

```css
:where([data-fullscreen] .vds-video-layout .vds-controls-group:nth-last-child(2)) {
  margin-bottom: -16px;
}
```

Source-internal anchor: lines 575-577.

### Fullscreen landscape reduced offset (selector: `@media (orientation: landscape)`)

```css
@media (orientation: landscape) {
  :where([data-fullscreen] .vds-video-layout .vds-controls-group:nth-last-child(2)) {
    margin-bottom: -12px;
  }
}
```

Source-internal anchor: lines 586-590.

### Small layout button size (selector: `:where(.vds-video-layout[data-sm])`)

```css
:where(.vds-video-layout[data-sm]) {
  --media-button-size: var(--video-sm-button-size, 36px);
}
```

Source-internal anchor: lines 110-112.

### Captions offset under controls (selectors for `.vds-captions`)

```css
:where([data-media-player][data-controls] .vds-video-layout .vds-captions) {
  bottom: var(--video-captions-offset, 78px);
}

:where([data-media-player][data-controls] .vds-video-layout[data-sm] .vds-captions) {
  bottom: var(--video-sm-captions-offset, 48px);
}
```

Source-internal anchor: lines 296-302.

## Structural metadata

- File: `player/styles/default/layouts/video.css`
- Package: `@vidstack/react@1.12.13`
- All `--video-*` prefixed properties are the consumer-facing public hook layer; they feed into `--media-*` internal primitives.
- No `::part()` selectors are used anywhere in this file.
- The negative margin technique is the mechanism by which the controls bar extends to or below the player's visible bottom edge.
