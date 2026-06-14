---
source_handle: vidstack-pkg-installed-css-1-12-13
fetched: 2026-06-14
source_path: /home/agent/SNC/platform/apps/web/node_modules/@vidstack/react/player/styles/
provenance: source-direct
---

## Paraphrase

The installed CSS files from `@vidstack/react@1.12.13` in the platform web app's node_modules. Three files read directly: `styles/base.css` (player + provider base layout), `styles/default/theme.css` (complete default theme with all CSS custom properties), and `styles/default/layouts/video.css` (video-layout-specific CSS variables and structure). These are the actual shipped CSS for the installed package version.

## Key passages — base.css and theme.css player sizing

**Player element (`[data-media-player]`):**
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
Default width: 100% (fills container). No default height set directly on the player.

**Default aspect-ratio for video:**
```css
:where([data-media-player][data-view-type='video']) {
  aspect-ratio: 16 / 9;
}
```
Applied with `:where()` (zero specificity) — easily overridden by any consumer rule.

**Provider element inherits aspect-ratio:**
```css
[data-media-provider] {
  width: 100%;
  aspect-ratio: inherit;
  overflow: hidden;
  border-radius: inherit;
}
[data-media-player]:not([data-view-type='audio']) [data-media-provider],
[data-media-player][data-fullscreen] [data-media-provider] {
  height: 100%;
}
```
Provider inherits aspect-ratio from the player element. In non-audio + non-fullscreen: `height: 100%`.

**Video element inside provider:**
```css
:where([data-media-provider] video) {
  aspect-ratio: inherit;
  height: auto;
  object-fit: contain;
  width: 100%;
}
[data-media-player][data-fullscreen] video {
  height: 100%;
}
```

## Key passages — CSS custom properties (theme.css public API)

The `--media-*` prefix is the public API for all default-theme components. Documented properties found in the source (non-exhaustive representative set):

**Buffering indicator:**
- `--media-buffering-size` (default: `96px`)
- `--media-buffering-track-color` (default: `#f5f5f5`)
- `--media-buffering-track-opacity` (default: `0.25`)
- `--media-buffering-track-fill-color` (default: `var(--media-brand)`)
- `--media-buffering-transition`

**Buttons:**
- `--media-button-size` (default: `40px`)
- `--media-button-border-radius` (default: `8px`)
- `--media-button-color` (default: `var(--media-controls-color, #f5f5f5)`)
- `--media-button-border`
- `--media-button-padding` (default: `0px`)
- `--media-button-icon-size` (default: `80%`)
- `--media-button-hover-bg` (default: `rgb(255 255 255 / 0.2)`)
- `--media-button-hover-transform` (default: `scale(1.05)`)
- `--media-button-hover-transition`
- `--media-button-touch-hover-border-radius` (default: `100%`)
- `--media-button-touch-hover-bg` (default: `rgb(255 255 255 / 0.2)`)
- `--media-fullscreen-button-size` (default: `42px`)
- `--media-sm-fullscreen-button-size` (default: `42px`)

**Live button:**
- `--media-live-button-width` (default: `40px`)
- `--media-live-button-height` (default: `40px`)
- `--media-live-button-font-size` (default: `12px`)
- `--media-live-button-font-weight` (default: `600`)
- `--media-live-button-letter-spacing` (default: `1.5px`)
- `--media-live-button-bg` (default: `#8a8a8a`) — off-edge state background
- `--media-live-button-border-radius` (default: `2px`)
- `--media-live-button-color` (default: `#161616`)
- `--media-live-button-padding` (default: `1px 4px`)
- `--media-live-button-edge-bg` (default: `#dc2626`) — at-edge state (red)
- `--media-live-button-edge-color` (default: `#f5f5f5`)

**Controls:**
- `--media-controls-padding` (default: `0px`)
- `--media-controls-color` (default: `#f5f5f5`)
- `--media-controls-out-transition` (default: `opacity 0.2s ease-out`)
- `--media-controls-in-transition` (default: `opacity 0.2s ease-in`)

**Focus ring:**
- `--media-focus-ring`

**Menus:**
- `--media-menu-bg`
- `--media-menu-color-inverse`, `--media-menu-color-gray-50` through `--media-menu-color-gray-400`
- `--media-menu-text-color`, `--media-menu-text-secondary-color`
- `--media-menu-border`
- `--media-menu-font-size` (default: `14px`)
- `--media-menu-font-weight` (default: `500`)
- `--media-menu-padding` (default: `12px`)
- `--media-menu-border-radius` (default: `4px`)
- `--media-menu-box-shadow`
- `--media-menu-max-height` (default: `250px`)
- `--media-menu-video-max-height` (default: `calc(var(--player-height) * 0.7)`)
- `--media-menu-min-width` (default: `280px`)
- `--media-menu-item-padding` (default: `10px`)
- `--media-menu-item-height` (default: `40px`)
- `--media-menu-item-hover-bg`
- `--media-menu-item-icon-size` (default: `18px`)
- `--media-menu-hint-color`, `--media-menu-hint-font-size` (default: `13px`)
- `--media-menu-section-gap` (default: `8px`)
- `--media-menu-section-header-font-size` (default: `12px`)
- `--media-sm-menu-portrait-max-height` (default: `40vh/40dvh`)
- `--media-sm-menu-landscape-max-height` (default: `min(70vh, 400px)`)
- `--media-menu-icon-rotate-deg` (default: `90deg`)

**Sliders:**
- `--media-slider-width` (default: `100%`)
- `--media-slider-height` (default: `48px`)
- `--media-slider-thumb-size` (default: `15px`)
- `--media-slider-focused-thumb-size`
- `--media-slider-track-height` (default: `5px`)
- `--media-slider-focused-track-height`
- `--media-slider-track-bg` (default: `rgb(255 255 255 / 0.3)`)
- `--media-slider-track-fill-bg` (default: `var(--media-brand)`)
- `--media-slider-track-border-radius` (default: `2px`)
- `--media-slider-thumb-bg` (default: `#fff`)
- `--media-slider-thumb-border` (default: `1px solid #cacaca`)
- `--media-slider-thumb-border-radius` (default: `9999px`)

**Captions:**
- `--media-captions-padding` (default: `1%`)
- `--media-cue-color`
- `--media-cue-bg` (default: `rgba(0, 0, 0, 0.7)`)
- `--media-cue-font-size`
- `--media-cue-line-height`
- `--media-cue-padding-x`
- `--media-user-text-color`, `--media-user-text-bg`, `--media-user-font-size`, `--media-user-font-family`

**Global:**
- `--media-brand` — the brand/accent color used for slider fill, buffering indicator, etc.
- `--media-font-family` (default: `sans-serif`)
- `--media-poster-bg` (default: `black`)

## Key passages — video.css (video-layout-specific)

The `--video-*` prefix is the video layout's own set, which maps through to `--media-*` variables:

```css
:where(.vds-video-layout) {
  --media-brand: var(--video-brand, #f5f5f5);
  --media-font-family: var(--video-font-family, sans-serif);
  --media-controls-color: var(--video-controls-color, #f5f5f5);
  --media-focus-ring-color: var(--video-focus-ring-color, rgb(78 156 246));
  --media-focus-ring: var(--video-focus-ring, 0 0 0 3px var(--media-focus-ring-color));
}
```

Player-level video layout styling:
```css
[data-media-player][data-layout='video'] {
  background-color: var(--video-bg, black);
}
[data-media-player][data-layout='video']:not([data-fullscreen]) {
  border-radius: var(--video-border-radius, 6px);
  border: var(--video-border, 1px solid rgb(255 255 255 / 0.1));
}
```

Video-layout-specific CSS variables (--video-* prefix):
- `--video-bg` (default: `black`)
- `--video-border-radius` (default: `6px`) — applied to player and controls overlay
- `--video-border` (default: `1px solid rgb(255 255 255 / 0.1)`) — non-fullscreen only
- `--video-brand` (default: `#f5f5f5`)
- `--video-font-family` (default: `sans-serif`)
- `--video-controls-color` (default: `#f5f5f5`)
- `--video-focus-ring-color` (default: `rgb(78 156 246)`)
- `--video-focus-ring`
- `--video-sm-chapter-title-font-size` (default: `15px`)
- `--video-fullscreen-chapter-title-font-size` (default: `16px`)
- `--video-sm-button-size` (default: `36px`)
- `--video-slider-thumbnail-border` (default: `1px solid #f5f5f5`)
- `--video-slider-thumbnail-border-radius` (default: `2px`)
- `--video-time-bg`
- `--video-volume-gap` (default: `10px`)
- `--video-volume-slider-max-width` (default: `72px`) — large layout
- `--video-volume-height` (default: `96px`) — small layout
- `--video-volume-bg`
- `--video-volume-border`
- `--video-volume-border-radius` (default: `8px`)
- `--video-sm-time-font-size` (default: `14px`)
- `--video-fullscreen-time-font-size` (default: `16px`)
- `--video-load-button-size` (default: `56px`)
- `--video-load-button-color` (default: `rgb(0 0 0 / 0.8)`)
- `--video-load-button-bg` (default: `var(--media-brand)`)
- `--video-load-button-border`
- `--video-load-button-border-radius` (default: `100%`)
- `--video-sm-load-button-size` (default: `48px`)
- `--video-sm-play-button-size` (default: `45px`)
- `--video-sm-play-button-bg` (default: `rgba(0 0 0 / 0.6)`)
- `--video-captions-transition` (default: `bottom 0.3s ease-in-out`)
- `--video-captions-offset` (default: `78px`) — caption bottom offset when controls visible
- `--video-sm-captions-offset` (default: `48px`) — small layout
- `--video-lg-fullscreen-captions-offset` (default: `54px`)
- `--video-gesture-seek-width` (default: `20%`)
- `--video-sm-slider-focus-track-height` (default: `12px`)
- `--video-sm-start-duration-padding` (default: `3px 6px`)
- `--video-sm-start-duration-color`
- `--video-sm-start-duration-bg` (default: `rgba(0 0 0 / 0.64)`)

## `data-*` attributes used for CSS targeting in video.css

- `.vds-video-layout[data-sm]` — small layout active
- `.vds-video-layout[data-lg]` — large layout active
- `.vds-video-layout:not([data-sm])` — large layout only
- `[data-fullscreen] .vds-video-layout` — fullscreen context
- `[data-media-player][data-layout='video']` — video layout active

## Class hooks

Public CSS classes present in the installed CSS:
- `.vds-video-layout` — the layout container (via `DefaultVideoLayout`)
- `.vds-controls`, `.vds-controls-group` — control bar containers
- `.vds-button` — all button elements
- `.vds-live-button`, `.vds-live-button-text` — live indicator
- `.vds-time`, `.vds-time-slider`, `.vds-slider`, `.vds-slider-thumb`, `.vds-slider-track` etc.
- `.vds-buffering-indicator`, `.vds-buffering-spinner`
- `.vds-captions`
- `.vds-gesture`
- `.vds-menu`, `.vds-menu-items`, `.vds-menu-item`
- `.vds-poster`
- `.vds-volume`, `.vds-volume-slider`, `.vds-volume-popup`

**No `::part()` selectors** are present in any of the three CSS files read. The public API surface consists entirely of: CSS custom properties (`--media-*`, `--video-*`), data attributes on `[data-media-player]` and layout elements, and the `.vds-*` class namespace. No shadow DOM / `::part()` usage found.

## Structure

Local files in installed npm package `@vidstack/react@1.12.13` at path:
- `/player/styles/base.css`
- `/player/styles/default/theme.css`
- `/player/styles/default/layouts/video.css`
