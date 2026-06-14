---
title: "F3 — Intended Model & Embedding Recipe (Official Docs)"
provenance: agent-synthesis
updated: 2026-06-14
campaign: vidstack-layout-behavior
specialist: F3
sources:
  - vidstack-docs-media-player-api
  - vidstack-docs-default-layout
  - vidstack-docs-loading-stream-type
  - vidstack-docs-live-button
  - vidstack-docs-responsive-design
  - vidstack-pkg-installed-css-1-12-13
---

# F3 — Intended Model & Embedding Recipe

## 1. Player Sizing: The Documented Model

### Default behavior (from installed CSS source)

The player element (`[data-media-player]`) is an `inline-flex` box that defaults to `width: 100%` — filling its container horizontally [vidstack-pkg-installed-css-1-12-13]{1}. No default height is set directly on the player. Instead, height is driven by the default aspect ratio.

The default aspect ratio for video is applied with zero-specificity `:where()`:

```css
:where([data-media-player][data-view-type='video']) {
  aspect-ratio: 16 / 9;
}
```

This means 16:9 is the baseline, and **any consumer CSS rule targeting `[data-media-player]` overrides it without a specificity fight** [vidstack-pkg-installed-css-1-12-13]{2}.

The provider (`[data-media-provider]`) inherits `aspect-ratio` from the player element and sets `overflow: hidden` and `border-radius: inherit`, so rounded corners on the player automatically clip the video [vidstack-pkg-installed-css-1-12-13]{3}.

### The `aspectRatio` prop

The `<MediaPlayer>` component accepts an `aspectRatio` prop of type `string` (default: `undefined`) [vidstack-docs-media-player-api]{4}. When set, this overrides the CSS default. Example (inferred from prop type — exact code example not in fetched docs): `<MediaPlayer aspectRatio="4/3">`.

The docs do not specify how the `aspectRatio` prop maps to CSS internally (whether it sets an inline style or a CSS property); this is a gap in the fetched documentation.

### Embedding in a constrained container

The official responsive-design docs state that **container queries are strongly recommended over media queries** for player styling, because they allow styles to adapt to the player container's dimensions rather than the viewport [vidstack-docs-responsive-design]{5}. This is the documented approach for constrained-container scenarios.

The docs acknowledge "avoiding layout shifts" as a concern — players should be sized to prevent jumping between default and intrinsic sizes during load [vidstack-docs-responsive-design]{6}.

**For fixed-height or overflow-hidden containers:** No explicit guidance was returned in any fetched page. The CSS architecture implies the correct approach: override `aspect-ratio` on `[data-media-player]` (the `:where()` makes this zero-cost), and set an explicit height. Since `[data-media-provider]` sets `overflow: hidden`, overflow clipping is already built in when the container constrains height [vidstack-pkg-installed-css-1-12-13]{7}.

**For rounded corners:** `border-radius: inherit` is present on both `[data-media-provider]` and `[data-media-provider] video` / `iframe`. Setting `border-radius` on the player element propagates to the video frame automatically [vidstack-pkg-installed-css-1-12-13]{8}. The video-layout CSS applies `--video-border-radius` (default: `6px`) to the player when `data-layout='video'` is active, and that same variable drives the controls overlay border-radius [vidstack-pkg-installed-css-1-12-13]{9}.

## 2. DefaultVideoLayout: smallLayoutWhen, Slots, and Customization

### smallLayoutWhen contract

The `smallLayoutWhen` prop accepts `boolean | ({ width, height }) => boolean`. Its default is [vidstack-docs-default-layout]{10}:

```js
({ width, height }) => width < 576 || height < 380
```

- When the condition is true, `data-sm` is set on `.vds-video-layout`; the small layout variant activates.
- When false or `'never'`, the small layout never activates.
- When passed a function, Vidstack calls it with the current player dimensions and evaluates dynamically.

**Data attributes exposed by the layout:**
- `data-match` — this layout is active (i.e. `DefaultVideoLayout` is the selected layout)
- `data-sm` — small layout variant is active
- `data-lg` — large layout variant is active
- `data-size` — string `"sm"` or `"lg"`

These data attributes are the correct hook for CSS targeting both inside and outside the layout tree.

### Slot system

The `slots` prop (type: `object`) accepts content slot definitions. Slot positions (verbatim from docs) [vidstack-docs-default-layout]{11}:

> bufferingIndicator, captionButton, captions, title, chapterTitle, currentTime, endTime, fullscreenButton, liveButton, livePlayButton, muteButton, pipButton, airPlayButton, googleCastButton, playButton, loadButton, seekBackwardButton, seekForwardButton, startDuration, timeSlider, volumeSlider, chaptersMenu, settingsMenu, settingsMenuItemsStart, settingsMenuItemsEnd, playbackMenuItemsStart, playbackMenuItemsEnd, playbackMenuLoop, accessibilityMenuItemsStart, accessibilityMenuItemsEnd, audioMenuItemsStart, audioMenuItemsEnd, captionsMenuItemsStart, captionsMenuItemsEnd

Each position can be prefixed with `before` or `after` to insert content adjacent to that position. Slot names can also be used to **replace** the component at that slot position.

### Minimal/no-controls layout

The docs do not document a "no controls" mode for `DefaultVideoLayout`. The following props are available to selectively disable/suppress components [vidstack-docs-default-layout]{12}:
- `disableTimeSlider: boolean` — disables the time slider
- `noGestures: boolean` — disables all gesture handling
- `noScrubGesture: boolean` — disables scrub gesture only
- `noKeyboardAnimations: boolean` — disables keyboard animations
- `noModal: boolean` — disables modal menus

There is no documented `noControls` or `controlsMode="hidden"` prop. The CSS architecture of the controls overlay (`.vds-controls`) uses `opacity: 0; visibility: hidden` by default and becomes `data-visible` on show — but the official docs do not document a supported prop for permanently hiding the controls bar. Using the `controls` prop on `<MediaPlayer>` (native controls, boolean, default `false`) enables the browser's native controls; this is distinct from the layout controls.

## 3. Public Styling API: CSS Custom Properties, Parts, and Class Hooks

### `--media-*` and `--video-*`: the documented public API

The default theme uses two variable namespaces as its public styling API. These are extracted from the installed `@vidstack/react@1.12.13` CSS source [vidstack-pkg-installed-css-1-12-13]{13}:

**`--media-*` variables** (apply to all default-theme components regardless of layout):
- `--media-brand` — accent color used for slider fill, buffering indicator, load button bg
- `--media-font-family` — typography
- `--media-controls-color` — default icon/text color for controls
- `--media-controls-padding` — padding around the controls overlay
- `--media-button-size` (default: `40px`)
- `--media-button-border-radius` (default: `8px`)
- `--media-button-color`
- `--media-button-hover-bg`, `--media-button-hover-transform`, `--media-button-hover-transition`
- `--media-fullscreen-button-size` (default: `42px`)
- `--media-live-button-width`, `--media-live-button-height` (both default: `40px`)
- `--media-live-button-bg` (default: `#8a8a8a`) — off-edge state
- `--media-live-button-edge-bg` (default: `#dc2626`) — at-edge state (red)
- `--media-live-button-color`, `--media-live-button-edge-color`
- `--media-live-button-font-size`, `--media-live-button-font-weight`, `--media-live-button-letter-spacing`, `--media-live-button-padding`, `--media-live-button-border-radius`
- `--media-slider-height` (default: `48px`)
- `--media-slider-track-height` (default: `5px`)
- `--media-slider-track-bg` (default: `rgb(255 255 255 / 0.3)`)
- `--media-slider-track-fill-bg` (default: `var(--media-brand)`)
- `--media-slider-thumb-size` (default: `15px`)
- `--media-slider-thumb-bg` (default: `#fff`)
- `--media-buffering-size` (default: `96px`)
- `--media-captions-padding`, `--media-cue-color`, `--media-cue-bg`
- `--media-menu-bg`, `--media-menu-max-height`, `--media-menu-video-max-height`
- `--media-focus-ring`

**`--video-*` variables** (video layout specific — mapped through to `--media-*` inside `.vds-video-layout`):
- `--video-bg` (default: `black`)
- `--video-border-radius` (default: `6px`) — player corner radius, controls overlay radius
- `--video-border` (default: `1px solid rgb(255 255 255 / 0.1)`) — non-fullscreen border
- `--video-brand` (default: `#f5f5f5`)
- `--video-controls-color` (default: `#f5f5f5`)
- `--video-focus-ring-color` (default: `rgb(78 156 246)`)
- `--video-sm-button-size` (default: `36px`)
- `--video-load-button-size` (default: `56px`)
- `--video-sm-play-button-size` (default: `45px`)
- `--video-sm-play-button-bg` (default: `rgba(0 0 0 / 0.6)`)
- `--video-captions-offset` (default: `78px`)
- `--video-sm-captions-offset` (default: `48px`)
- `--video-captions-transition`
- `--video-volume-bg`, `--video-volume-border`, `--video-volume-border-radius`

### `::part()` selectors

**No `::part()` selectors are present in any of the installed CSS files.** The player does not use Shadow DOM components — all elements are in the regular DOM with `.vds-*` class names. There is no `::part()` surface [vidstack-pkg-installed-css-1-12-13]{14}.

### `.vds-*` class namespace

The `.vds-*` class prefix is the selector namespace used throughout the default theme. These classes appear directly on DOM elements (not in shadow DOM). Key classes:
- `.vds-video-layout` — top-level layout wrapper
- `.vds-controls`, `.vds-controls-group` — controls container and rows
- `.vds-button` — all buttons
- `.vds-live-button`, `.vds-live-button-text` — live indicator
- `.vds-time-slider`, `.vds-slider`, `.vds-slider-thumb`, `.vds-slider-track`, `.vds-slider-track-fill`
- `.vds-buffering-indicator`, `.vds-buffering-spinner`
- `.vds-captions`
- `.vds-poster`
- `.vds-gesture`
- `.vds-menu`, `.vds-menu-items`, `.vds-menu-item`
- `.vds-volume`, `.vds-volume-popup`

The docs do not explicitly designate these as public vs. internal. The CSS custom property (`--media-*` / `--video-*`) layer is the officially documented customization surface on the layout docs page [vidstack-docs-default-layout]{15}; the `.vds-*` classes are present in shipped CSS and usable, but the docs do not call them out as a stable public API.

### `data-*` attribute API on the player

The following data attributes on `[data-media-player]` are documented as the CSS hook surface [vidstack-docs-media-player-api]{16}:
- `data-live` — stream is live
- `data-live-edge` — playback is at the live edge
- `data-can-seek` — seeking is possible
- `data-stream-type` — current stream type value
- `data-view-type` — "audio" or "video"
- `data-paused`, `data-playing`, `data-buffering`, `data-ended`, `data-started`
- `data-fullscreen`, `data-pip`
- `data-controls` — controls are currently visible
- `data-muted`, `data-seeking`, `data-waiting`
- `data-load` — loading strategy
- `data-orientation` — "landscape" or "portrait"

These are the supported way to write CSS conditional on player state.

## 4. Live Stream UI

### LIVE button behavior

The `LiveButton` component [vidstack-docs-live-button]{17}:
- Hides itself (`aria-hidden="true"`) when the stream is not live.
- Shows the live indicator text at all times during a live stream.
- Exposes `data-edge` when playback is at the live edge, `data-hidden` when not live.
- The CSS source distinguishes two visual states [vidstack-pkg-installed-css-1-12-13]{18}:
  - **Off-edge:** background `--media-live-button-bg` (default `#8a8a8a` — gray)
  - **At-edge (`data-edge`):** background `--media-live-button-edge-bg` (default `#dc2626` — red)
- Clicking it dispatches `onMediaLiveEdgeRequest` (seeks to live edge).

### streamType and UI implications

Setting `streamType` on `<MediaPlayer>` tells the player how to "appropriately present UI components and layouts" [vidstack-docs-loading-stream-type]{19}. The five values: `on-demand`, `live`, `live:dvr`, `ll-live`, `ll-live:dvr`.

For `live` (non-DVR): the time slider is disabled if seeking is not permitted — the slider thumb pins to the right edge [vidstack-docs-media-player-api]{20}. The `canSeek` state property and `data-can-seek` attribute reflect this.

Recommendation: **explicitly set `streamType`**; inference "can be less accurate (e.g., at identifying DVR support)" [vidstack-docs-loading-stream-type]{21}.

### Fullscreen in small layouts

The video-layout CSS shows that the small layout (`data-sm`) in fullscreen context gets specific adjustments [vidstack-pkg-installed-css-1-12-13]{22}:
```css
:where([data-fullscreen] .vds-video-layout[data-sm] .vds-controls-group:last-child) {
  margin-bottom: 0;
}
```
This removes the negative bottom margin used in the non-fullscreen small layout to tighten the control bar, which would otherwise push controls off-screen in fullscreen. The controls overlay also gains `border-radius: 0` behavior naturally because `--video-border-radius` is only applied when `not([data-fullscreen])` [vidstack-pkg-installed-css-1-12-13]{23}.

The docs do not document a "fullscreen behavior in small layout" as a named feature. The CSS handles it structurally.

### No separate small-layout live stream docs

The `LiveButton` docs do not provide guidance on live stream UI in small vs. large layouts specifically. The slot system allows replacing or augmenting `liveButton` and `livePlayButton` slots in `DefaultVideoLayout`, which is the documented extension point for layout-variant customization [vidstack-docs-default-layout]{24}.

## Disconfirming analysis

**On "no ::part() support":** The absence of `::part()` selectors in the installed CSS files is direct evidence, not an argument from silence. All styling hooks are regular-DOM class selectors and CSS custom properties. The docs do not describe a shadow DOM model anywhere in the fetched pages.

**On "aspectRatio prop is the supported sizing API":** the `aspectRatio` prop appears in the MediaPlayer API reference [vidstack-docs-media-player-api]{4}, but its internal mechanism is not documented. The CSS source shows the `aspect-ratio` property on `[data-media-player]` uses `:where()` zero specificity, which means direct CSS override also works without any prop. Both approaches are present; the CSS override is confirmed from source; prop internals are undocumented.

**On "smallLayoutWhen false disables small layout":** the docs state `false` or `'never'` disables it [vidstack-docs-default-layout]{10}. This is consistent with the CSS: without `data-sm` being set, `.vds-video-layout[data-sm]` rules never activate. No contradicting source found.

**On "no minimal/no-controls layout":** the absence of a documented prop is the finding, not a confirmed incapability. The slots system (replacing the `timeSlider`, `muteButton`, etc. slots with `null`) may suppress those elements. This was not tested and is not documented — it is an open question, not a confirmed behavior.

## Contradictions

**CSS variables vs. docs page**: The default-layout docs page states CSS variables exist for video layout customization, but the variable list was behind a code block not returned by WebFetch. The installed CSS source provides the authoritative list. The two sources are consistent in existence but the docs page cannot be cited for the exact variable names — the CSS source is the ground truth here.

**"smallLayoutWhen accepts 'never'"**: The default-layout docs state `false` or `'never'` can be used. These are not equivalent: `false` is a static boolean; `'never'` is a string constant. The relationship between `'never'` and `false` is not further documented. Risk: `'never'` may be a string that coerces differently from `false` — needs verification in implementation.

## Revisit if

- Vidstack releases post-1.12.13 versions that document a `::part()` surface or add `noControls`/`controlsMode` to `DefaultVideoLayout`.
- The docs site returns full CSS variable listings (currently truncated by the docs page's code block).
- The `aspectRatio` prop's internal mechanism is clarified (inline style vs. CSS variable vs. other).
- `smallLayoutWhen: 'never'` vs. `false` behavior is clarified in docs or source.
- A confirmed approach for a "no controls" layout via slots is verified.
