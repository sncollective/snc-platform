---
id: content-badge-media-contrast
kind: story
stage: done
tags: [design-system, content, ux-polish]
parent: null
depends_on: []
release_binding: null
gate_origin: operator feedback 2026-08-14 (post-drain dev review)
created: 2026-08-14
updated: 2026-08-14
---

# Content badges over media: guaranteed-contrast treatment

## Bug (operator-verified)

The transparent Audio / Video / Post tags on content cards are hard to read on images where
the badge shares a color with the picture or the picture lacks contrast against it.

Mechanism: `content-card.module.css` positions `.badge` absolutely **on the thumbnail** but
styles it with the page-surface treatment — `--color-text` over an 18% transparent category
tint. `--color-text` is mode-aware ink designed for page surfaces; over arbitrary imagery an
18% tint guarantees nothing (near-black text on a dark photo, or near-white on a bright one,
collapses). The sibling `.lockOverlay`, on the same thumbnail, already uses the correct
on-media contract (`--color-overlay-strong` scrim).

## Fix

Overlay badges adopt the on-media contract; inline badges (on the card body surface) keep the
tint + `--color-text` treatment, which is correct there:

- `.badge` (overlay base): `background: var(--color-overlay-strong)`, `color: var(--color-on-media)`.
- Category color remains as the 1px border cue (non-text reinforcement; the label text is the signal).
- `.badgeInline`: resets to the page-surface treatment (per-type category tint + `--color-text`).

## Acceptance

- Overlay badges render white-on-scrim over any image, both modes (scrim composite ≥4.5:1
  for the small text worst case).
- Inline badges unchanged (tint + ordinary text on page surface).
- Contract test asserts the media treatment (overlay badge → on-media + overlay-strong;
  inline badge → tint + text) so the pattern cannot silently regress.
- No other badge-over-media sites remain on the page-surface treatment (audit: media-picker
  thumbnails already use `--color-media-border`; content-management-list badges are inline on
  surfaces — unaffected).

## Implementation notes (2026-08-14)

Fix landed as designed: `.badge:not(.badgeInline)` (specificity 0,2,0) overrides the
per-type surface pairing with `--color-overlay-strong` + `--color-on-media`; the per-type
1px border stays as the non-text category cue. Inline badges unchanged. Same on-media
scrim pattern the sibling `.lockOverlay` already used — precedent, not invention.

Contract guard: `apps/web/tests/unit/styles/content-badge-contrast.test.ts` (parsing-based,
per the repo's module-contract test pattern) pins the overlay/inline split and rejects raw
literals in the badge rules. Full web suite green (2,020).

**Org follow-up:** org will publish `--color-badge-*-on-media` reference roles (brighter,
scrim-free variants) in the next reference pass — when they land, the overlay treatment can
consume them for a lighter look; adoption is a value-pass ride-along, not new structure.
