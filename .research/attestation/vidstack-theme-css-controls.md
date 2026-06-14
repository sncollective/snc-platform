---
source_handle: vidstack-theme-css-controls
fetched: 2026-06-14
source_path: node_modules/.bun/@vidstack+react@1.12.13+b2e33729a97476bf/node_modules/@vidstack/react/player/styles/default/theme.css
provenance: source-direct
---

## Summary

Second attestation of `default/theme.css` (2,456 lines), scoped to control positioning, the provider overflow model, and the base controls overlay structure. The prior attestation (`vidstack-theme-css.md`) covered aspect-ratio inheritance; this one covers the controls positioning and overflow clipping architecture.

## Key passages with source-internal anchors

### Provider element overflow:hidden (selector: `[data-media-provider]`, lines 45-54)

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

Source-internal anchor: lines 45-54 of theme.css. The `[data-media-provider]` element has `overflow: hidden`. This element wraps the `<video>` element.

### Player root element (selector: `[data-media-player]`, lines 7-15)

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

Source-internal anchor: lines 7-15 of theme.css. The player root has `position: relative` and `contain: style`. No `overflow: hidden` is set on the player root.

### Non-audio provider height:100% (selector: lines 56-59)

```css
[data-media-player]:not([data-view-type='audio']) [data-media-provider],
[data-media-player][data-fullscreen] [data-media-provider] {
  height: 100%;
}
```

Source-internal anchor: lines 56-59. The provider fills the player's full height in video mode.

### Video controls overlay (selector: `:where([data-view-type='video'] .vds-controls)`, lines 627-640)

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

Source-internal anchor: lines 627-640 of theme.css. The controls overlay is `position: absolute` with `inset: 0` — it is placed relative to the `[data-media-player]` stacking context, not the `[data-media-provider]`.

### Controls spacer (lines 648-651)

```css
:where(.vds-controls-spacer) {
  flex: 1 1 0%;
  pointer-events: none;
}
```

Source-internal anchor: lines 648-651. The spacers are flex-grow elements that push control groups to the bottom.

### Button base dimensions (lines 217-238)

```css
:where(.vds-button) {
  ...
  width: var(--media-button-size, 40px);
  height: var(--media-button-size, 40px);
  ...
}
```

Source-internal anchor: lines 217-238. Default button size is 40px, customizable via `--media-button-size`.

## Structural metadata

- File: `player/styles/default/theme.css` (2,456 lines)
- Package: `@vidstack/react@1.12.13`
- The controls overlay (`.vds-controls`) is `position: absolute; inset: 0` — it is a sibling to `[data-media-provider]`, not a child. The provider's `overflow: hidden` therefore does not clip the controls.
- If a consumer wraps the player in a container with a fixed aspect-ratio AND `overflow: hidden`, the controls' negative-margin extension below the player box would be clipped, because the controls would be a descendant of that overflow-clipped wrapper.
- `--media-controls-padding` (default `0px`) is the CSS custom property for inner padding of the entire controls overlay.
