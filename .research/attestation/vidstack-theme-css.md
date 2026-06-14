---
source_handle: vidstack-theme-css
fetched: 2026-06-14
source_path: node_modules/.bun/@vidstack+react@1.12.13+b2e33729a97476bf/node_modules/@vidstack/react/player/styles/default/theme.css
provenance: source-direct
---

## Summary

`default/theme.css` (2,456 lines) is the full compiled stylesheet for the default Vidstack theme.
It begins with a verbatim copy of `base.css` (lines 1–154 are byte-identical to base.css), then
continues with all default-theme component styles: controls, menus, sliders, captions, keyboard
shortcuts, and more. It is designed to be imported INSTEAD of or IN ADDITION TO `base.css`;
importing both causes the base rules to be declared twice (harmless due to identical content but
redundant).

## Key passages with source-internal anchors

**Lines 21–23 — video aspect-ratio (zero-specificity, verbatim from base.css):**
```css
:where([data-media-player][data-view-type='video']) {
  aspect-ratio: 16 / 9;
}
```

**Lines 30–33 — started + controls-hidden rule (verbatim from base.css, no aspect-ratio):**
```css
[data-media-player][data-view-type='video'][data-started]:not([data-controls]) {
  pointer-events: auto;
  cursor: none;
}
```
Confirmed: no `aspect-ratio` property in this block.

**Lines 45–54 — provider inherits aspect-ratio (verbatim from base.css):**
```css
[data-media-provider] {
  ...
  aspect-ratio: inherit;
  ...
}
```

**Lines 75–84 — video/iframe inherit aspect-ratio (verbatim from base.css):**
```css
:where([data-media-provider] video),
:where([data-media-provider] iframe) {
  aspect-ratio: inherit;
  ...
}
```

**Lines 107–116 — .vds-blocker also inherits aspect-ratio:**
```css
.vds-blocker {
  ...
  aspect-ratio: inherit;
  ...
}
```

The remainder of the file (lines 155–2456) contains buffering indicator, buttons, states,
captions, controls, gesture, keyboard action, menus, sliders, radio, and color picker styles.
None of these sections contain additional `aspect-ratio` rules for the player root.

## Structural metadata

- File: `player/styles/default/theme.css` (2,456 lines)
- Is a superset of `base.css` (first 154 lines are verbatim copy of base.css)
- Platform imports both `base.css` and `theme.css`, causing the first 154 lines to be evaluated twice (functionally harmless)
- No `aspect-ratio` rules beyond the `base.css`-copied block
- All `aspect-ratio` in this file descend from the single `:where([data-media-player][data-view-type='video']) { aspect-ratio: 16/9 }` declaration at zero specificity
