---
source_handle: vidstack-layout-js
fetched: 2026-06-14
source_path: node_modules/.bun/@vidstack+react@1.12.13+b2e33729a97476bf/node_modules/@vidstack/react/dev/chunks/vidstack-BIA_pmri.js
provenance: source-direct
---

## Summary

This chunk contains the `createDefaultMediaLayout` factory and the two concrete layout
configurations (`DefaultVideoLayout` and `DefaultAudioLayout`). It implements the
`smallLayoutWhen` signal/computed system that drives the `data-sm` / `data-lg` / `data-size`
attributes on the layout wrapper `<div>`. The file is the dev (unminified) build variant;
the corresponding prod file is `prod/chunks/vidstack-D27o2o-g.js` with functionally identical
behavior.

## Key passages with source-internal anchors

**Line 1289–1298 — video layout `smLayoutWhen` default:**
```js
const MediaLayout = createDefaultMediaLayout({
  type: "video",
  smLayoutWhen({ width, height }) {
    return width < 576 || height < 380;
  },
  renderLayout(props) {
    return /* @__PURE__ */ React.createElement(VideoLayout, { ...props });
  }
});
```
The video layout considers the player **small** when `width < 576` OR `height < 380`.

**Lines 1107–1110 — audio layout `smLayoutWhen` default:**
```js
const MediaLayout$1 = createDefaultMediaLayout({
  type: "audio",
  smLayoutWhen({ width }) {
    return width < 576;
  },
```
Audio layout uses only width; no height threshold.

**Lines 64–82 — `createDefaultMediaLayout` React component factory (how `data-sm` is set):**
```js
smallLayoutWhen = smLayoutWhen,   // default is the type-specific smLayoutWhen above
...
const $smallWhen = createComputed(() => {
  return isBoolean(smallLayoutWhen) ? smallLayoutWhen : smallLayoutWhen(media.player.state);
}, [smallLayoutWhen]);
...
isSmallLayout = $smallWhen(),
...
return React.createElement("div", {
  ...props,
  className: `vds-${type}-layout` + ...,
  "data-sm": isSmallLayout ? "" : null,
  "data-lg": !isSmallLayout ? "" : null,
  "data-size": isSmallLayout ? "sm" : "lg",
  ...
```
`isSmallLayout` is a computed signal reading `media.player.state` (width + height of the
player element, not the viewport). The `data-sm` attribute is set on the layout `<div>`, NOT on
the `[data-media-player]` root.

**Line 71 — isSmallLayout feeds the rendered layout branch:**
```js
isSmallLayout ? React.createElement(DefaultVideoSmallLayout, null)
             : React.createElement(DefaultVideoLargeLayout, null)
```

## Structural metadata

- Source: dev chunk, `vidstack-BIA_pmri.js`
- `smLayoutWhen` receives `media.player.state` — the player element's measured dimensions
- `data-sm` is set on `.vds-video-layout` div, not on `[data-media-player]`
- The `smallLayoutWhen` prop accepts: boolean (forced layout) | function taking player state → boolean
- Default thresholds: video → width < 576 || height < 380; audio → width < 576
