---
provenance: agent-synthesis
updated: 2026-06-14
facet: F2 — Control Layout & Positioning
sources:
  - vidstack-controls-css
  - vidstack-video-layout-css
  - vidstack-theme-css-controls
  - vidstack-layout-js-f2
---

# F2 — Vidstack v1.12.13 Control Layout & Positioning

This specialist brief covers how `DefaultVideoLayout` positions its controls relative to the
player box, the structure of control groups, the small vs. large layout split, and the public
CSS API for consumer override.

---

## 1. Control container structure and video overlay positioning

The `.vds-controls` element is `position: absolute; inset: 0; width: 100%; height: 100%`
relative to the `[data-media-player]` root [vidstack-controls-css]{1}[vidstack-theme-css-controls]{1}.
It is a **sibling** of `[data-media-provider]`, not a child of it. The provider has
`overflow: hidden` [vidstack-theme-css-controls]{2}, but because the controls live outside
the provider subtree, the provider's overflow does not clip them.

The controls overlay is a `display: flex; flex-direction: column` column. Inside it, control
groups are separated by `DefaultControlsSpacer` elements (`.vds-controls-spacer`, which have
`flex: 1 1 0%` [vidstack-controls-css]{3}). This pushes the actual button groups to the top
and bottom of the overlay, gravity-separated.

Base rules for `.vds-controls-group`:

- `:where(.vds-controls), :where(.vds-controls-group)` — `position: relative; display: inline-block; width: 100%; box-sizing: border-box` [vidstack-controls-css]{4}
- `.vds-video-layout .vds-controls-group` — overrides to `display: flex; align-items: center; padding: 4px 6px; z-index: 0` [vidstack-video-layout-css]{1}

---

## 2. Large layout group structure and the negative-margin mechanism

`DefaultVideoLargeLayout` renders four `.vds-controls-group` elements inside `.vds-controls`
[vidstack-layout-js-f2]{1}:

| Position | Group role | nth-child |
|---|---|---|
| Group 1 | Top row (empty by default; menu slots) | 1st / first-child |
| Group 2 | Center row (empty by default; center slots) | 2nd |
| Group 3 | Time-slider | 3rd / **nth-last-child(2)** |
| Group 4 | Bottom buttons (play, volume, time, fullscreen, etc.) | 4th / last-child |

Flex spacers between groups 1↔2, 2↔3, and 3↔4 push groups to the extremes.

### The critical negative-margin rules

**Group 3 (time-slider, nth-last-child(2)):**

```css
/* video.css lines 67-72 */
.vds-video-layout .vds-controls-group:nth-last-child(2) {
  padding: 0 12px;
  z-index: 11;
  margin-bottom: -16px;
}
```

[vidstack-video-layout-css]{2}

This `-16px` margin pulls the slider group downward by 16px relative to its normal flex
position. It overlaps with group 4 (the button row below it).

**Group 4 (bottom buttons, last-child) — context offsets:**

```css
/* video.css lines 74-79 */
.vds-video-layout:not([data-sm]) .vds-controls-group:last-child {
  --media-menu-y-offset: 26px;
  --media-tooltip-y-offset: 26px;
  --media-slider-preview-offset: 26px;
  z-index: 10;
}
```

[vidstack-video-layout-css]{3}

These offsets push menus, tooltips, and slider previews upward — compensating for the fact
that the bottom button row sits lower than it would without the negative margin on group 3.

**The result:** The bottom of group 4 (the actual control bar bottom edge) can protrude
slightly below the bottom of the `.vds-controls` overlay box, because group 3's negative
margin shifts the content column slightly downward. This is the intended design — controls
appear to bleed toward the bottom edge of the player.

**In fullscreen (portrait):**

```css
/* video.css lines 575-577 */
:where([data-fullscreen] .vds-video-layout .vds-controls-group:nth-last-child(2)) {
  margin-bottom: -16px;
}
```

[vidstack-video-layout-css]{4}

In fullscreen landscape, the offset is reduced to `-12px` [vidstack-video-layout-css]{5}.

---

## 3. Why a fixed-aspect + overflow:hidden wrapper clips the control bar

The `.vds-controls` overlay is `position: absolute; inset: 0` relative to `[data-media-player]`
[vidstack-theme-css-controls]{3}. If the consumer wraps the player in a container that has:

1. A fixed height or aspect-ratio constraint, AND
2. `overflow: hidden`

…then any part of the controls that extends beyond the container's bounds — including the
bottom button row if it's pushed toward or past the player's bottom edge — will be clipped.

The negative `margin-bottom: -16px` on group 3 shifts the whole bottom-half of the controls
column slightly downward. In a player that exactly fills its container (the default video
`aspect-ratio: 16/9` behavior [vidstack-theme-css-controls]{4}), group 4's bottom edge sits at
or near the player's bottom boundary. An `overflow: hidden` on any ancestor in the stacking
chain (at or above `[data-media-player]`) will clip anything that extends beyond that
boundary.

**The specific bug path:** If a wrapper element has `overflow: hidden` and the player fills
that wrapper, the `-16px` bottom margin on the slider group and any resulting overflow of
group 4 below the player box will be clipped by the wrapper's `overflow: hidden`. The control
bar disappears or is partially hidden at the bottom.

**The `[data-media-provider]` overflow does not cause this** — its `overflow: hidden` only
clips the video element itself, because `.vds-controls` is not a descendant of the provider
[vidstack-theme-css-controls]{2}.

---

## 4. Small layout (`[data-sm]`): group structure and the reversed slider order

The `[data-sm]` attribute is set on `.vds-video-layout` when the player width < 576px OR
height < 380px [vidstack-layout-js-f2]{2}. The small layout is rendered by
`DefaultVideoSmallLayout`.

`DefaultVideoSmallLayout` renders four `.vds-controls-group` elements [vidstack-layout-js-f2]{3}:

| Position | Group role | nth-child |
|---|---|---|
| Group 1 | Top row (captions, menus, volume, AirPlay) | 1st / first-child |
| Group 2 | Center row (play button only, `pointerEvents: none`) | 2nd / **nth-last-child(3)** |
| Group 3 | Time-info + fullscreen (`DefaultTimeInfo` + `fullscreenButton`) | 3rd / **nth-last-child(2)** |
| Group 4 | Time-slider | 4th / last-child |

**Key difference from large layout:** The time-slider is LAST (not second-to-last). Group 3
(nth-last-child(2)) is the TIME-INFO + FULLSCREEN row, not the slider row.

### Small layout group CSS overrides

**Group-level padding reduction:**

```css
/* video.css lines 465-467 */
.vds-video-layout[data-sm] .vds-controls-group {
  padding: 2px;
}
```

[vidstack-video-layout-css]{6}

**Group 3 (nth-last-child(2)) in small layout — pointer-events off:**

```css
/* video.css lines 451-453 */
:where(.vds-video-layout[data-sm] .vds-controls-group:nth-last-child(2)) {
  pointer-events: none;
}
```

[vidstack-video-layout-css]{7}

**Group 4 (last-child / time-slider) in small layout — negative margins:**

```css
/* video.css lines 455-459 */
:where(.vds-video-layout[data-sm] .vds-controls-group:last-child) {
  z-index: 2;
  margin-top: -2.5px;
  margin-bottom: -6px;
}
```

[vidstack-video-layout-css]{8}

In fullscreen, the small layout bottom margin resets to zero [vidstack-video-layout-css]{9}.

### Which control bar renders in small layout for live streams

The LIVE indicator appears via `DefaultTimeInfo` which conditionally renders `DefaultLiveButton`
(a `<LiveButton>` element with class `vds-live-button`) when the stream type is live
[vidstack-layout-js-f2]{4}. In the small layout, `DefaultTimeInfo` is in **group 3
(nth-last-child(2))**. The fullscreen button also lives in group 3. Group 4 (last-child) is
the time-slider.

For a live stream in small layout: **group 3 = (LIVE button + fullscreen button)**. This is
the visible bottom control bar.

---

## 5. Public CSS styling API

### 5a. `--video-*` consumer hook variables (defined in video.css)

These are the documented consumer-facing hooks. They feed into internal `--media-*` primitives
[vidstack-video-layout-css]{10}.

| Consumer property | Default value | Internal target |
|---|---|---|
| `--video-bg` | `black` | background of `[data-media-player][data-layout='video']` |
| `--video-border-radius` | `6px` | border-radius on player, controls overlay, and gradient |
| `--video-border` | `1px solid rgb(255 255 255 / 0.1)` | border on player (non-fullscreen) |
| `--video-brand` | `#f5f5f5` | feeds `--media-brand` |
| `--video-font-family` | `sans-serif` | feeds `--media-font-family` |
| `--video-controls-color` | `#f5f5f5` | feeds `--media-controls-color` and `color` |
| `--video-focus-ring-color` | `rgb(78 156 246)` | feeds `--media-focus-ring-color` |
| `--video-focus-ring` | `0 0 0 3px var(--media-focus-ring-color)` | feeds `--media-focus-ring` |
| `--video-sm-button-size` | `36px` | feeds `--media-button-size` in `[data-sm]` |
| `--video-captions-offset` | `78px` | `bottom` of captions when controls visible |
| `--video-sm-captions-offset` | `48px` | `bottom` of captions in small layout |
| `--video-volume-gap` | `10px` | feeds `--gap` for volume popup positioning |
| `--video-volume-bg` | `(menu-default)` | background of volume popup |
| `--video-slider-thumbnail-border` | `1px solid #f5f5f5` | thumbnail border on time slider |
| `--video-sm-chapter-title-font-size` | `15px` | chapter title size in small layout |
| `--video-fullscreen-chapter-title-font-size` | `16px` | chapter title size in fullscreen |
| `--video-sm-time-font-size` | `14px` | time display font-size in small layout |
| `--video-fullscreen-time-font-size` | `16px` | time display font-size in fullscreen |
| `--video-load-button-size` | `56px` | play button size in load state |
| `--video-sm-play-button-size` | `45px` | play button size in small layout |
| `--video-sm-play-button-bg` | `rgba(0 0 0 / 0.6)` | play button bg in small layout |
| `--video-gesture-seek-width` | `20%` | width of seek gesture zones |
| `--video-lg-fullscreen-captions-offset` | `54px` | captions offset, fullscreen large |
| `--video-captions-transition` | `bottom 0.3s ease-in-out` | captions transition |

### 5b. `--media-*` internal primitives (override-able but not the primary consumer layer)

These are used internally but can be overridden when `--video-*` hooks do not exist:

| Property | Default | Purpose |
|---|---|---|
| `--media-controls-padding` | `0px` | inner padding of `.vds-controls` overlay [vidstack-controls-css]{5} |
| `--media-controls-in-transition` | `opacity 0.2s ease-in` | fade-in animation [vidstack-controls-css]{6} |
| `--media-controls-out-transition` | `opacity 0.2s ease-out` | fade-out animation [vidstack-controls-css]{7} |
| `--media-button-size` | `40px` | button dimensions [vidstack-theme-css-controls]{5} |
| `--media-brand` | (from `--video-brand`) | accent color |
| `--media-menu-y-offset` | `6px` (overridden to `26px` in large layout last group) | menu vertical offset |
| `--media-tooltip-y-offset` | `6px` (overridden to `26px` in large layout last group) | tooltip vertical offset |

### 5c. `::part()` selectors — none

Neither the CSS files nor the React component code use `part=` attributes or `::part()`
selectors anywhere in the controls or layout elements [vidstack-layout-js-f2]{5}. There is
no Shadow DOM involved; the components render into the regular DOM. Consumer overrides use
`.vds-*` class selectors or CSS custom properties.

### 5d. `.vds-*` classes for consumer targeting

The layout exposes targeting via stable class names (not `::part()`):

- `.vds-controls` — the overlay container
- `.vds-controls-group` — each row; combine with `:nth-child()`, `:last-child`, `:nth-last-child(2)` to target specific rows
- `.vds-controls-group:last-child` (large layout) — the bottom button row
- `.vds-controls-group:nth-last-child(2)` (large layout) — the time-slider row
- `.vds-video-layout[data-sm] .vds-controls-group:last-child` — time-slider row in small layout
- `.vds-video-layout[data-lg]` vs `.vds-video-layout[data-sm]` — selectors for large vs small layout

Note: `.vds-*` classes are used internally throughout and the library does not explicitly
distinguish "stable public API" from "internal" in its CSS class naming. The `--video-*`
variables are the clearest signal of public API intent — they are the indirection layer set up
in `video.css` to feed the internal `--media-*` layer.

---

## Disconfirming analysis

**"The provider's overflow:hidden clips the controls"** — This is a plausible false hypothesis
because `[data-media-provider]` visually coincides with the player boundary and has
`overflow: hidden`. However, the source confirms `.vds-controls` has `position: absolute;
inset: 0` relative to `[data-media-player]` and is not a child of `[data-media-provider]`
[vidstack-theme-css-controls]{1}[vidstack-controls-css]{8}. The provider's overflow only clips
its own children (the `<video>` element). This disconfirms the hypothesis that fixing the
provider's overflow would resolve clipping of the control bar.

**"The negative offset in `bottom: calc(-1 * var(--gap))`"** — The task brief references this
pattern. Reviewing all three CSS source files, no `bottom: calc(-1 * var(--gap))` rule exists
on any `.vds-controls-group` or `.vds-controls` element. The `calc(-1 * var(--gap))` pattern
appears only in the volume-slider safe-area pseudo-element
(`.vds-video-layout[data-sm] .vds-mute-button::after { bottom: calc(-1 * var(--gap)) }`) and
the large-layout volume slider safe-area
(`.vds-video-layout[data-lg] .vds-volume-slider::after { left: calc(-1 * var(--gap)) }`)
[vidstack-video-layout-css]{11}. The actual bottom-extension mechanism for the control bar is
the `margin-bottom: -16px` on `nth-last-child(2)`, not a `bottom:` property.

**"There are no ::part() selectors"** — This is potentially surprising. The source confirms
that no `::part()` or `exportparts` attributes appear in the layout component or its CSS
[vidstack-layout-js-f2]{5}. Vidstack's default layout uses regular DOM and CSS custom
properties, not Shadow DOM parts.

---

## Contradictions

No source contradictions found. The CSS files and JS chunk are internally consistent. The
controls overlay positioning is confirmed by both `controls.css` and `theme.css` (they define
identical base rules [vidstack-controls-css]{4}[vidstack-theme-css-controls]{6}).

---

## Revisit if

- The `DefaultVideoLayout` source changes at a version upgrade — the negative-margin technique
  and group ordering are internal implementation details and could change. Check
  `player/styles/default/layouts/video.css` and the layout JS chunk at each upgrade.
- The live indicator's position changes — currently it renders via `DefaultTimeInfo` in
  group 3 (nth-last-child(2)) in the small layout; this is coupling between the JS component
  and the CSS nth-child targeting.
- A consumer-facing `::part()` API is added — this would be the preferred way to allow
  override of shadow DOM parts, but the current release has none.
- Vidstack publishes explicit documentation of stable vs. internal CSS API — the `--video-*`
  vs `--media-*` distinction is inferred from the indirection pattern in `video.css`, not from
  explicit documentation.
