---
title: "Vidstack v1.12.13 — layout, sizing & control-positioning behavior"
provenance: agent-synthesis
updated: 2026-06-14
campaign: vidstack-layout-behavior
output_kind: behavioral-reference
specialists:
  - player-box-sizing (F1)
  - control-layout-positioning (F2)
  - intended-model-embedding (F3)
---

# Vidstack v1.12.13 — layout, sizing & control-positioning behavior

Cross-synthesis of the campaign's three facets. Scope: how the pinned `@vidstack/react@1.12.13`
player establishes its box, how `DefaultVideoLayout` positions its controls relative to that
box, what the supported customization surface is, and — the engagement's driving question —
why embedding the player in a fixed-aspect `overflow:hidden` wrapper clips the bottom control
bar, plus the source-grounded fix. Primary truth is the installed source; official docs supply
the intended model.

## 1. How the player box is sized

- The default video aspect is set with a **zero-specificity** rule:
  `:where([data-media-player][data-view-type='video']) { aspect-ratio: 16/9 }` [vidstack-base-css]{1}.
  `:where()` forces specificity (0,0,0) deliberately — any consumer selector of any weight
  overrides it without `!important` [vidstack-base-css]{2}. The player root is `width:100%`
  with no explicit height, so aspect-ratio is the sole vertical-axis constraint in normal flow
  [vidstack-base-css]{3}.
- **The `aspectRatio` prop becomes an inline style.** The React bridge maps
  `<MediaPlayer aspectRatio="16/9">` to `style={{ aspectRatio, ...props.style }}` on the element
  [vidstack-react-player-bridge]{1}. Inline styles outrank every stylesheet rule, so once the
  prop is set the box is pinned to that ratio regardless of CSS. Both platform players pass
  `aspectRatio="16/9"` for video [platform-video-player-tsx]{1}[platform-global-player-css]{1}.
- **There is NO conditional `aspect-ratio: inherit` flip.** The
  `[data-media-player][data-view-type='video'][data-started]:not([data-controls])` selector
  exists but sets only `pointer-events:auto; cursor:none` (the controls-hidden cursor behavior)
  [vidstack-base-css]{4}. The only `aspect-ratio: inherit` declarations are on the *provider*
  and its `<video>`/`<iframe>` children, not the player root [vidstack-base-css]{5}. *(This
  overturns the hypothesis that drove the first failed fix attempt on
  `live-player-control-bar-overflow` — see §5.)*
- **Specificity ladder for `aspect-ratio` on the player** (high→low): inline style from the
  `aspectRatio` prop → an app `.class media-player` rule, e.g. `.expanded :global(media-player)`
  at (0,1,1) → a bare `[data-media-player]` rule at (0,1,0) → Vidstack's `:where()` fallback at
  (0,0,0) [vidstack-base-css]{6}[platform-global-player-css]{2}. To change the ratio: pass a
  different `aspectRatio` prop (inline, always wins) **or** write any >0-specificity rule while
  NOT setting the prop.

## 2. Small vs large layout

- `DefaultVideoLayout` is **small** when the player measures `width < 576 || height < 380`
  (the `smLayoutWhen` default); audio uses `width < 576` only [vidstack-layout-js]{1}. These are
  the **player's own** rendered dimensions, not the viewport [vidstack-layout-js]{2}.
- The result drives `data-sm` / `data-lg` / `data-size` on the `.vds-video-layout` **div** — NOT
  on `[data-media-player]` [vidstack-layout-js]{3}. No rule changes `aspect-ratio` based on layout
  size [vidstack-layout-js]{3}. Docs confirm the contract (`boolean | ({width,height})=>boolean`;
  `false`/`'never'` disables) [vidstack-docs-default-layout]{1}.
- Practical consequence for this app: at mobile `/live` widths and in the 200px docked
  mini-player, the player is **always in small layout**; desktop `/live` is large.

## 3. How controls are positioned (and why they extend past the box)

- `.vds-controls` is `position:absolute; inset:0` on `[data-media-player]` — a **sibling** of
  `[data-media-provider]`, not a child [vidstack-controls-css]{1}[vidstack-theme-css-controls]{1}.
  The provider's `overflow:hidden` clips only the `<video>`, **not** the controls
  [vidstack-theme-css-controls]{2}. (So "fix the provider overflow" would not help — disconfirmed.)
- The overlay is a flex column; spacer elements (`flex:1 1 0%`) push control groups to the top
  and bottom edges [vidstack-controls-css]{2}.
- **The bottom control group is pulled past the player's bottom edge by a negative margin** —
  this is the mechanism behind the clip:
  - **Large layout:** the time-slider group (`:nth-last-child(2)`) has `margin-bottom: -16px`
    [vidstack-video-layout-css]{1}; the last group's menus/tooltips are offset up `26px` to
    compensate [vidstack-video-layout-css]{2}.
  - **Small layout:** the last group (time-slider) has `margin-top:-2.5px; margin-bottom:-6px`
    [vidstack-video-layout-css]{3}; in `[data-sm]` the LIVE indicator + fullscreen button render
    in the `:nth-last-child(2)` group via `DefaultTimeInfo` [vidstack-layout-js-f2]{1}.
  - In **fullscreen** small layout the bottom margin resets to `0` [vidstack-video-layout-css]{4}
    — Vidstack itself neutralizes the overhang where clipping would hurt, which is the same
    technique the fix below applies to constrained embeds.
- The negative margin is intentional (controls "bleed" to the bottom edge). It is harmless in
  Vidstack's default use because nothing clips the player; it becomes visible/clipped only when a
  consumer constrains the box (§5).

## 4. The supported customization surface

- **No `::part()` / Shadow DOM.** The default layout renders into regular DOM; no `part=`
  attributes exist [vidstack-layout-js-f2]{2}[vidstack-pkg-installed-css-1-12-13]{1}.
- **CSS custom properties are the documented public surface** — two namespaces:
  `--media-*` (theme-wide primitives; e.g. `--media-controls-padding` default `0px`, the inner
  padding of `.vds-controls`) and `--video-*` (video-layout hooks that feed `--media-*` inside
  `.vds-video-layout`; e.g. `--video-border-radius` default `6px`, which drives both the player
  corner radius AND the controls-overlay radius) [vidstack-video-layout-css]{5}[vidstack-pkg-installed-css-1-12-13]{2}.
  The docs present these vars as the customization API [vidstack-docs-default-layout]{2}.
- **`.vds-*` classes are usable but not designated stable API.** They are real DOM classes
  (`.vds-controls`, `.vds-controls-group`, `.vds-video-layout[data-sm]`, etc.) and are the only
  way to target a specific control group, but Vidstack does not document them as a stability
  contract [vidstack-video-layout-css]{6}[vidstack-pkg-installed-css-1-12-13]{3}. Targeting them
  works; pin it behind a revisit-if for version upgrades.
- **Layout suppression levers (documented):** `disableTimeSlider`, `noGestures`, `noScrubGesture`,
  `noModal`, plus the `slots` system (34+ named positions, each prefixable `before`/`after` or
  replaceable) [vidstack-docs-default-layout]{3}. There is **no documented `noControls` /
  `controlsMode=hidden`** for `DefaultVideoLayout` [vidstack-docs-default-layout]{3}.
- **Live UI:** `LiveButton` auto-hides when not live; `data-edge` flips its bg from gray
  (`--media-live-button-bg`) to red (`--media-live-button-edge-bg`); explicitly setting
  `streamType="live"` is recommended over inference [vidstack-docs-live-button]{1}[vidstack-docs-loading-stream-type]{1}.

## 5. The constrained-container clip — diagnosis & fix

**Mechanism (synthesized):** the player box is pinned 16:9 (inline `aspectRatio` prop, §1); the
controls overlay `inset:0` within that box but the bottom group is pushed ~6px (small) / ~16px
(large) **below** the box by negative margin (§3). The app's player wrappers
(`.expanded`, `.collapsedOverlay`, and the live `.playerContainer`) set `overflow:hidden` to clip
to `--video-border-radius` rounded corners — which also clips the protruding control bar. The
mini-player (fixed 200×112 box) clips it outright; an unconstrained `/live` wrapper lets it hang
visibly below the video.

**Why attempt 1 failed:** it moved the 16:9 box onto the wrappers and set the inner player to
`height:100%`. But the box was never the problem (the prop already pins 16:9), and filling +
`overflow:hidden` made *all three* presentations clip the overhang consistently — it addressed a
non-cause (the imagined `aspect-ratio:inherit` flip, which doesn't exist, §1) and left the real
cause (negative-margin overhang under `overflow:hidden`) untouched. Reverted.

**Supported fix (source-grounded):** neutralize the bottom group's negative margin within the
app's constrained player wrappers, so controls overlay *within* the frame — exactly what Vidstack
does itself in fullscreen small layout (`margin-bottom:0`, §3) [vidstack-video-layout-css]{4}.
Target the small-layout bottom group (mobile `/live` + mini) and the large-layout group if the
desktop wrapper also clips:

```css
/* scope under the app's player wrappers only */
.expanded :global(.vds-video-layout[data-sm] .vds-controls-group:last-child),
.collapsedOverlay :global(.vds-video-layout[data-sm] .vds-controls-group:last-child) {
  margin-top: 0;
  margin-bottom: 0;
}
.expanded :global(.vds-video-layout:not([data-sm]) .vds-controls-group:nth-last-child(2)) {
  margin-bottom: 0;
}
```

This keeps both the controls and the rounded corners. It targets `.vds-*` classes (not a
documented stability contract), so it carries a revisit-if for upgrades.

**Spot-check refinement (specificity):** the small-layout overhang rules are themselves
`:where()`-wrapped — `:where(.vds-video-layout[data-sm] .vds-controls-group:last-child){…}` at
video.css:455 → specificity **(0,0,0)** [vidstack-video-layout-css]{3} — so the override above
(a class-scoped descendant selector) wins outright, no `!important` needed. The large-layout
rule `.vds-video-layout .vds-controls-group:nth-last-child(2)` (video.css:68) is **not**
`:where()`-wrapped → (0,3,0) [vidstack-video-layout-css]{1}; the `.expanded :global(...)`
override is higher and still wins. Vidstack's own fullscreen reset
(`:where([data-fullscreen] .vds-video-layout[data-sm] .vds-controls-group:last-child){margin-bottom:0}`,
video.css:461) is the in-library precedent for this exact neutralization [vidstack-video-layout-css]{4}.

Alternatives weighed: (a) drop wrapper `overflow:hidden` and round via `--video-border-radius` /
the provider's inherited `border-radius` — controls then show but hang below the video (the
original visible-overflow look); (b) `--media-controls-padding` (a more-public `--media-*` var) —
but it pads the overlay, it does not cleanly cancel a group's negative margin, so it is not a
reliable counter. Option in the code block above is preferred; validate via the screenshot loop
at 375px (`/live` small layout), desktop `/live` (large), and the docked mini-player.

## Disconfirming analysis

- *Does the provider's `overflow:hidden` cause the clip?* No — `.vds-controls` is a sibling of the
  provider, not a descendant [vidstack-theme-css-controls]{2}[vidstack-controls-css]{1}. Fixing
  provider overflow would not help.
- *Is there a `bottom: calc(-1 * var(--gap))` on a controls group?* No — that pattern is only on
  volume-slider safe-area pseudo-elements; the bottom-extension mechanism is the group
  `margin-bottom` [vidstack-video-layout-css]{1}.
- *Does `data-sm` change aspect-ratio?* No rule combines `[data-sm]` with `aspect-ratio` in
  base/theme/video CSS [vidstack-layout-js]{3}.

## Contradictions

- **Premise vs source (resolved):** the engagement seed asserted a
  `[data-started]:not([data-controls]) { aspect-ratio: inherit }` flip; it is **absent** from the
  installed v1.12.13 source [vidstack-base-css]{4}. Not a source-vs-source contradiction — an
  absence from the only authoritative source; the box-pin is the inline `aspectRatio` prop
  instead [vidstack-react-player-bridge]{1}.
- **Documented vs empirical (tension, consistent):** docs do not specify how the `aspectRatio`
  prop maps to CSS [vidstack-docs-media-player-api]{1}; the installed bridge shows it is an inline
  style [vidstack-react-player-bridge]{1}. Consistent — docs are silent, source is explicit.
- **`smallLayoutWhen: 'never'` vs `false` (open):** docs present both as disabling, but a string
  vs a boolean may coerce differently; unverified [vidstack-docs-default-layout]{1}. Non-load-bearing
  for the fix.

## Revisit if

- A Vidstack upgrade changes the control-group structure, the negative-margin technique, or the
  `:nth-last-child` ordering (these are internal `.vds-*` implementation details — re-read
  `player/styles/default/layouts/video.css` + the layout JS at each bump).
- Vidstack adds a `::part()` surface or a documented `noControls`/`controlsMode` — would supersede
  the `.vds-*`-class fix.
- The `aspectRatio` prop changes from inline-style to a CSS var (would shift the §1 specificity
  ladder).
- `smallLayoutWhen` thresholds (576/380) change in a minor version.
