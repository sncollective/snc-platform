# S/NC mark usage — PROVISIONAL

> **Provisional mechanical guidance.** This note keeps current platform assets consistent; it is
> not the cooperative's brand or trademark specification. The organization will author that
> specification after stakeholder review. Do not use this note to justify stationery, legal,
> partnership, or other permanence-implying applications.

The canonical artwork is [`apps/web/public/logo-mark.svg`](../apps/web/public/logo-mark.svg), a
square 1080-unit brush-script S/NC lockup. Preserve its paths and proportions.

## Clear space

Define **1x as 108 artwork units**, one tenth of the square viewBox. Keep at least 1x of empty
space around all four sides of the visible paths. Background fields may extend through that
space; type, rules, icons, crops, and other marks may not. At small digital sizes, increase the
space rather than reducing the artwork's internal gaps.

This unit is derived from the lockup geometry so it scales with the asset. It is provisional,
not an optical or trademark judgment.

## Color

The mark is single-color artwork and can be recolored without redrawing it.

- **Ink / light ground:** cast60 `#171929` mark on papyrus `#EFE9D8`.
- **Reversed / dark ground:** papyrus `#EFE9D8` mark on cast60 `#171929`.
- **Monochrome production:** one solid ink or one reversed knockout. Keep every path the same
  color and opacity.
- Surface-family accents may frame the mark, as on social cards, but do not recolor individual
  paths or turn the lockup into a multicolor mark.

Check contrast against any ground not listed above; do not place the mark directly over busy
imagery.

## Minimum sizes and reduction

The full six-path lockup is the default artwork at **32px square and larger** in favicon tiles.
At **16px**, use the isolated sweeping slash reduction in
[`favicon.svg`](../apps/web/public/favicon.svg), not a manually simplified S/NC redraw. The SVG
switches to that reduction below 24px; the PNG fallback chain mirrors the 16/32px tiers.

For touch icons and social cards, use the complete lockup. Do not infer print minimums from these
digital sizes; the organization specification must set them after proofing.

## Tiles

**Do**

- Use papyrus/cast60 as a paired light/dark tile.
- Center the supplied artwork in a square field and preserve the built-in padding.
- Use the supplied rounded tile geometry for browser icons and the complete mark for 32px+ and
  touch assets.
- Regenerate raster fallbacks from the SVG when the source or values change.

**Don't**

- Typeset `S/NC` as a substitute for the artwork.
- Stretch, rotate, outline, add a drop shadow, or independently move its paths.
- Crop the complete lockup to manufacture a small icon; use the supplied slash reduction.
- Add a border, badge, or surface-family accent inside the favicon tile.
- Treat the favicon reduction as a standalone cooperative signature outside constrained icon
  contexts.
