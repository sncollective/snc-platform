---
source_handle: vidstack-base-css
fetched: 2026-06-14
source_path: node_modules/.bun/@vidstack+react@1.12.13+b2e33729a97476bf/node_modules/@vidstack/react/player/styles/base.css
provenance: source-direct
---

## Summary

`base.css` is the minimal reset stylesheet for the Vidstack player at v1.12.13. It establishes
dimensional defaults for the `[data-media-player]` root element, the `[data-media-provider]` inner
wrapper, and the raw `video`/`iframe` elements. The file is 153 lines total.

## Key passages with source-internal anchors

**Lines 7–15 — player root defaults:**
```css
[data-media-player] {
  width: 100%;
  display: inline-flex;
  align-items: center;
  position: relative;
  contain: style;
  box-sizing: border-box;
  user-select: none;
}
```
The root element is `width: 100%` with no explicit height. No `aspect-ratio` is set here.

**Lines 21–23 — base video aspect-ratio (zero-specificity wrapper):**
```css
:where([data-media-player][data-view-type='video']) {
  aspect-ratio: 16 / 9;
}
```
The `:where()` pseudo-class reduces the compound selector's specificity to (0,0,0). Any app-authored
rule targeting `[data-media-player]` or `media-player` with any specificity wins over this.

**Lines 30–33 — started + controls-hidden rule (no aspect-ratio):**
```css
[data-media-player][data-view-type='video'][data-started]:not([data-controls]) {
  pointer-events: auto;
  cursor: none;
}
```
This selector has specificity (0,4,0) — four attribute selectors. It sets only `pointer-events`
and `cursor`. There is NO `aspect-ratio: inherit` declaration on this selector in this file.

**Lines 45–54 — provider inherits aspect-ratio:**
```css
[data-media-provider] {
  display: flex;
  position: relative;
  box-sizing: border-box;
  align-items: center;
  border-radius: inherit;
  width: 100%;
  aspect-ratio: inherit;
  overflow: hidden;
}
```
The `[data-media-provider]` element inherits `aspect-ratio` from the player root, propagating
whatever value the root resolves to down into the video container.

**Lines 75–84 — video/iframe inside provider also inherit aspect-ratio (zero-specificity):**
```css
:where([data-media-provider] video),
:where([data-media-provider] iframe) {
  aspect-ratio: inherit;
  ...
}
```

## Structural metadata

- File: `player/styles/base.css` (153 lines)
- Intended use: imported alongside a theme CSS (or alone for custom styling)
- No `@import` statements — standalone file
- All aspect-ratio cascade from `[data-media-player]` down via `inherit`
- The `[data-started]:not([data-controls])` selector does NOT set `aspect-ratio` in this file
