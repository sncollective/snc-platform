---
source_handle: vidstack-controls-css
fetched: 2026-06-14
source_path: node_modules/.bun/@vidstack+react@1.12.13+b2e33729a97476bf/node_modules/@vidstack/react/player/styles/default/controls.css
provenance: source-direct
---

## Summary

The `controls.css` file defines the base structural rules for `.vds-controls` and `.vds-controls-group` elements. These are the foundational positioning rules before layout-specific overrides (such as those in `video.css`) are applied.

## Key passages

### Base layout of controls and groups (selector: `:where(.vds-controls), :where(.vds-controls-group)`)

```css
:where(.vds-controls),
:where(.vds-controls-group) {
  position: relative;
  display: inline-block;
  width: 100%;
  box-sizing: border-box;
}
```

Source-internal anchor: lines 7-13 of controls.css.

### Video controls overlay (selector: `:where([data-view-type='video'] .vds-controls)`)

```css
:where([data-view-type='video'] .vds-controls) {
  display: flex;
  position: absolute;
  flex-direction: column;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  padding: var(--media-controls-padding, 0px);
  transition: var(--media-controls-out-transition, opacity 0.2s ease-out);
}
```

Source-internal anchor: lines 32-45 of controls.css.

### Video controls visible state (selector: `:where([data-view-type='video'] .vds-controls[data-visible])`)

```css
:where([data-view-type='video'] .vds-controls[data-visible]) {
  opacity: 1;
  visibility: visible;
  transition: var(--media-controls-in-transition, opacity 0.2s ease-in);
}
```

Source-internal anchor: lines 47-51 of controls.css.

### Controls spacer (selector: `:where(.vds-controls-spacer)`)

```css
:where(.vds-controls-spacer) {
  flex: 1 1 0%;
  pointer-events: none;
}
```

Source-internal anchor: lines 53-56 of controls.css.

## Structural metadata

- File: `player/styles/default/controls.css`
- Package: `@vidstack/react@1.12.13`
- The `--media-controls-padding` CSS custom property controls inner padding of the controls overlay.
- The `--media-controls-out-transition` and `--media-controls-in-transition` CSS custom properties control fade animation.
- No negative margin or `bottom:` rules are present in this file — those come from `video.css`.
