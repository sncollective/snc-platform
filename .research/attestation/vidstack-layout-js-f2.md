---
source_handle: vidstack-layout-js-f2
fetched: 2026-06-14
source_path: node_modules/.bun/@vidstack+react@1.12.13+b2e33729a97476bf/node_modules/@vidstack/react/dev/chunks/vidstack-BIA_pmri.js
provenance: source-direct
---

## Summary

The chunk file `vidstack-BIA_pmri.js` contains the full React implementation of the default video layout components including `DefaultVideoLayout`, `DefaultVideoLargeLayout`, and `DefaultVideoSmallLayout`. It defines the `smLayoutWhen` breakpoint function, the DOM structure (classNames) of control groups, and the `data-sm`/`data-lg` data-attribute logic.

## Key passages with source-internal anchors

### smLayoutWhen breakpoint for DefaultVideoLayout (line 1289)

```javascript
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

Source-internal anchor: lines 1289-1298 of vidstack-BIA_pmri.js. The small layout activates when the player width < 576px OR player height < 380px.

### data-sm / data-lg attribute assignment (lines 79-80)

```javascript
"data-sm": isSmallLayout ? "" : null,
"data-lg": !isSmallLayout ? "" : null,
```

Source-internal anchor: lines 79-80 (also repeated at 309-310 and 1022-1023). These attributes are set on the `.vds-video-layout` element. When `isSmallLayout` is true, `data-sm=""` is present; otherwise `data-lg=""`.

### VideoLayout routing logic (line 1302)

```javascript
function VideoLayout({ streamType, isLoadLayout, isSmallLayout }) {
  useLayoutName("video");
  return isLoadLayout
    ? /* @__PURE__ */ React.createElement(DefaultVideoLoadLayout, null)
    : streamType === "unknown"
    ? /* @__PURE__ */ React.createElement(DefaultBufferingIndicator, null)
    : isSmallLayout
    ? /* @__PURE__ */ React.createElement(DefaultVideoSmallLayout, null)
    : /* @__PURE__ */ React.createElement(DefaultVideoLargeLayout, null);
}
```

Source-internal anchor: line 1302 of vidstack-BIA_pmri.js.

### DefaultVideoLargeLayout DOM structure (line 1307)

The large layout renders exactly 4 `.vds-controls-group` elements inside `.vds-controls`:

1. **Group 1 (top):** `topControlsGroupStart`, spacer, `topControlsGroupCenter`, spacer, `topControlsGroupEnd`, (optional `DefaultVideoMenus` if menuGroup==="top")
2. **`DefaultControlsSpacer`** (between group 1 and 2)
3. **Group 2 (center):** `centerControlsGroupStart`, spacer, `centerControlsGroupCenter`, spacer, `centerControlsGroupEnd`
4. **`DefaultControlsSpacer`** (between group 2 and 3)
5. **Group 3 (time-slider):** `timeSlider` only — this is the nth-last-child(2) group
6. **Group 4 (bottom buttons):** `playButton`, `DefaultVolumePopup`, `DefaultTimeInfo`, `chapterTitle`, `captionButton`, (optional menus), `airPlayButton`, `googleCastButton`, `downloadButton`, `pipButton`, `fullscreenButton`

Source-internal anchor: line 1307. The nth-last-child(2) is group 3 (time-slider); group 4 (bottom buttons) is nth-last-child(1) / last-child.

### DefaultVideoSmallLayout DOM structure (line 1312)

The small layout renders exactly 4 `.vds-controls-group` elements:

1. **Group 1 (top):** `topControlsGroupStart`, `airPlayButton`, `googleCastButton`, spacer, `topControlsGroupCenter`, spacer, `captionButton`, `downloadButton`, `DefaultVideoMenus`, `DefaultVolumePopup`, `topControlsGroupEnd`
2. **`DefaultControlsSpacer`**
3. **Group 2 (center/play):** `centerControlsGroupStart`, spacer, `centerControlsGroupCenter`, `playButton`, spacer, `centerControlsGroupEnd` — rendered with `style={{ pointerEvents: "none" }}`
4. **`DefaultControlsSpacer`**
5. **Group 3 (time info):** `DefaultTimeInfo`, `chapterTitle`, `fullscreenButton` — this is nth-last-child(2)
6. **Group 4 (time-slider):** `timeSlider` only — this is the LAST child

Source-internal anchor: line 1312. In the SMALL layout, the order is REVERSED compared to large: the time-slider group is LAST (nth-last-child(1)), and the time-info+fullscreen group is nth-last-child(2).

## Structural metadata

- File: `dev/chunks/vidstack-BIA_pmri.js`
- Package: `@vidstack/react@1.12.13`
- The large layout's nth-last-child(2) is the TIME-SLIDER group; the small layout's nth-last-child(2) is the TIME-INFO+FULLSCREEN group (which includes the live indicator and fullscreen button).
- The LIVE button renders inside the DefaultTimeInfo component — visible in both layouts.
- No `part=` attributes are set on any `.vds-controls` or `.vds-controls-group` elements in the React component code; styling hooks are through CSS class names and CSS custom properties only.
