---
provenance: agent-synthesis
updated: 2026-06-14
sources:
  - vidstack-base-css
  - vidstack-theme-css
  - vidstack-layout-js
  - vidstack-react-player-bridge
  - platform-global-player-css
  - platform-video-player-tsx
---

# F1 — Player Box Sizing: Vidstack v1.12.13

How the Vidstack player at v1.12.13 establishes its box dimensions — sourced from the installed
files.

---

## 1. Base aspect-ratio rule: the `:where()` zero-specificity wrapper

**Source rule** (`base.css` lines 21–23 and `theme.css` lines 21–23): [vidstack-base-css]{1}

```css
:where([data-media-player][data-view-type='video']) {
  aspect-ratio: 16 / 9;
}
```

The `:where()` pseudo-class reduces the selector's specificity to **(0,0,0)** — zero. Without
`:where()`, `[data-media-player][data-view-type='video']` would carry specificity (0,2,0). By
wrapping the whole thing in `:where()`, Vidstack intentionally makes this rule the weakest
possible: any application rule targeting even a single attribute (`[data-media-player]`, 0,1,0)
or a type selector (`media-player`, 0,0,1) wins over it without needing `!important`.

**Purpose of the zero-specificity choice:** the default 16/9 ratio is a fallback that any
consumer CSS can override by writing a selector of any specificity on the player element.

The `[data-media-player]` root is also set to `width: 100%` with no explicit height, so the
aspect-ratio is the sole sizing constraint on the vertical axis in normal flow. [vidstack-base-css]{2}

---

## 2. The `[data-started]:not([data-controls])` rule: what it actually does

**Source rule** (`base.css` lines 30–33, `theme.css` lines 30–33): [vidstack-base-css]{3}

```css
[data-media-player][data-view-type='video'][data-started]:not([data-controls]) {
  pointer-events: auto;
  cursor: none;
}
```

**Critical finding:** This selector does NOT set `aspect-ratio: inherit` or any other
aspect-ratio property. It sets only `pointer-events: auto` and `cursor: none` — the cursor
hide behavior for controls-auto-hide (when playback has started and controls have hidden).

The specificity of this selector is **(0,4,0)** — four attribute selectors (`[data-media-player]`,
`[data-view-type='video']`, `[data-started]`, `:not([data-controls])`). Because `:not()` when
given an attribute argument adds that attribute's specificity, this selector is higher-specificity
than the `:where()` 16/9 rule, but carries no aspect-ratio declaration, so the cascade for
`aspect-ratio` is unaffected by this rule's presence.

There is no `aspect-ratio: inherit` rule in either `base.css` or `theme.css` that is gated on
`[data-started]` or `[data-controls]`. The task brief's premise that this selector fires
`aspect-ratio: inherit` is **not present in the installed source**.

---

## 3. The `aspectRatio` prop: how it maps to CSS

**Source** (`dev/vidstack.js` lines 200–215): [vidstack-react-player-bridge]{1}

```js
const MediaPlayer = React.forwardRef(
  ({ aspectRatio, children, ...props }, forwardRef) => {
    return React.createElement(MediaPlayerBridge, {
      ...props,
      src: props.src,
      ref: forwardRef,
      style: {
        aspectRatio,
        ...props.style
      }
    }, ...);
  }
);
```

The `aspectRatio` prop is extracted from the props object and placed directly into `style.aspectRatio`.
The result is an **inline `style` attribute** on the rendered element, e.g.:
`style="aspect-ratio: 16/9"`.

Inline styles carry the highest possible specificity in the CSS cascade — they are applied after
all stylesheet rules regardless of selector weight. The only way to override an inline style from
a stylesheet is via `!important`.

Note the spread order: `style: { aspectRatio, ...props.style }`. If the caller also passes
`style={{ aspectRatio: 'something-else' }}`, the `props.style.aspectRatio` key from `...props.style`
will overwrite the `aspectRatio` prop. In practice, callers should use one or the other.

**Platform usage:**
- `video-player.tsx` always passes `aspectRatio="16/9"` [platform-video-player-tsx]{1}
- `global-player.tsx` passes `aspectRatio="16/9"` for video (conditional on `!isAudio`) [platform-global-player-css]{1}

---

## 4. The `smallLayoutWhen` default threshold and the small/large layout decision

**Source** (`dev/chunks/vidstack-BIA_pmri.js` line 1289): [vidstack-layout-js]{1}

```js
const MediaLayout = createDefaultMediaLayout({
  type: "video",
  smLayoutWhen({ width, height }) {
    return width < 576 || height < 380;
  },
  ...
});
```

The video layout is **small** when the player element measures width < 576px OR height < 380px.
These are player dimensions, not viewport dimensions — the measurement is taken from
`media.player.state` (the internal state object that tracks the player's own rendered size).

The computed signal updates reactively: `createComputed(() => smallLayoutWhen(media.player.state))`.
[vidstack-layout-js]{2}

**How `data-sm` is set:** the result of this computation drives three HTML attributes on the
layout `<div>` (NOT on `[data-media-player]`): [vidstack-layout-js]{3}

```js
"data-sm": isSmallLayout ? "" : null,
"data-lg": !isSmallLayout ? "" : null,
"data-size": isSmallLayout ? "sm" : "lg",
```

The layout `<div>` has class `vds-video-layout` and carries these attributes. CSS rules in
`layouts/video.css` target `.vds-video-layout[data-sm]` to apply small-layout visual variants
(smaller controls, different time display, etc.). The `aspect-ratio` of the player root is not
affected by `data-sm` — no rules in any of the inspected files change `aspect-ratio` based on
layout size.

For audio, the threshold is width < 576 only (no height constraint). [vidstack-layout-js]{4}

---

## 5. How app CSS on `media-player` interacts with Vidstack's rules

**Source:** [platform-global-player-css]{2}, [vidstack-base-css]{4}

The Vidstack rule for 16/9 has specificity (0,0,0) via `:where()`. Application CSS wins over it
through any specificity. There are two main paths in the platform code:

**Path A — inline style via `aspectRatio` prop (highest specificity):**
Both player components pass `aspectRatio="16/9"`, producing `style="aspect-ratio: 16/9"` on the
`media-player` element. This is an inline style and wins over all stylesheet rules unconditionally.

**Path B — `global-player.module.css` `.expanded :global(media-player)` rule:**
```css
.expanded :global(media-player) {
  width: 100%;
  aspect-ratio: 16 / 9;
}
```
After CSS Modules compilation this becomes `.expanded_HASH media-player { aspect-ratio: 16/9 }`.
Specificity: (0,1,1) — one class + one element selector. This beats Vidstack's `:where()` at
(0,0,0) and also beats the non-wrapped `[data-media-player]` attribute selector at (0,1,0).
However, it is still below the inline style of Path A, so Path B is redundant whenever the
`aspectRatio` prop is also set (which it always is in the current code for video).

**Specificity ladder for `aspect-ratio` on the player element, highest to lowest:**

| Rule | Specificity | Location |
|---|---|---|
| `style="aspect-ratio: 16/9"` (from `aspectRatio` prop) | Inline | MediaPlayer React bridge |
| `.expanded_HASH media-player { aspect-ratio: 16/9 }` | (0,1,1) | global-player.module.css:9–12 |
| (hypothetical app rule: `[data-media-player] { aspect-ratio: X }`) | (0,1,0) | — |
| `:where([data-media-player][data-view-type='video']) { aspect-ratio: 16/9 }` | (0,0,0) | base.css/theme.css |

If an app wants to override the player's aspect-ratio to something other than 16/9, it must either:
1. Pass a different value to the `aspectRatio` prop (becomes inline style — always wins), or
2. Write a rule with any specificity > 0 targeting the player element (beats the `:where()` fallback),
   while NOT using the `aspectRatio` prop (which would set an inline style overriding the stylesheet rule).

---

## Disconfirming analysis

**Claim: `[data-started]:not([data-controls])` sets `aspect-ratio: inherit`.**
Searched both `base.css` and `theme.css` for any `aspect-ratio` declaration within that
selector. The selector appears at `base.css` lines 30–33 and `theme.css` lines 30–33; neither
contains `aspect-ratio`. The claim is not supported by the installed source. The only
`aspect-ratio: inherit` declarations in these files are on `[data-media-provider]` (line 52),
`:where([data-media-provider] video/iframe)` (line 77), and `.vds-blocker` (line 112) — all
downstream child elements that inherit from the player root, not the root itself.

**Claim: `data-sm` affects aspect-ratio.**
Searched `base.css`, `theme.css`, and `layouts/video.css` for any selector combining `[data-sm]`
with `aspect-ratio`. No such rule exists in any of these files.

**Claim: the `aspectRatio` prop maps to a data attribute or CSS custom property.**
Source read of `dev/vidstack.js` shows it maps to `style.aspectRatio` (inline style). It is
not a data attribute and does not set any CSS custom property (e.g., `--media-aspect-ratio`).

---

## Contradictions

**Between task brief and installed source:**
The task brief asks to attest "the conditional flip `[data-started]:not([data-controls]) { aspect-ratio: inherit }` — WHEN it fires." This rule **does not exist** in `base.css` or `theme.css` at v1.12.13. The selector exists but carries only `pointer-events` and `cursor` declarations. This is not a contradiction between two sources — it is an absence from the only relevant sources.

No contradictions found between `base.css` and `theme.css` for the rules within facet scope (the two files share the same relevant rules verbatim, with `theme.css` being a superset).

---

## Revisit if

- A future Vidstack version adds `aspect-ratio: inherit` to the `[data-started]:not([data-controls])` selector (changing the aspect-ratio behavior at playback start).
- Vidstack changes the `aspectRatio` prop to set a CSS custom property instead of an inline style (would change specificity interplay with app CSS).
- The `smLayoutWhen` thresholds (576/380) change in a minor version, affecting responsive layout breakpoints.
- Platform adds any CSS targeting `[data-media-player]` with `aspect-ratio` — would need to account for specificity order relative to the `:where()` fallback and any inline `aspectRatio` prop.
- CSS Modules compilation is updated such that `:global()` handling changes the compiled specificity of the `.expanded :global(media-player)` rule.
