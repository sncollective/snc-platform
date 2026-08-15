---
id: identity-assets-pass
kind: feature
stage: done
tags: [design-system, ui]
parent: visual-identity-exploration
depends_on: []
release_binding: null
gate_origin: visual-identity direction #1 (org-adjudicated: cheap re-derivations now)
created: 2026-08-15
updated: 2026-08-15
---

# Identity assets pass — favicon + og/social cards

Org ruling: favicon tile + og cards are cheap re-derivations of the existing mark + settled
values — fine now on provisional values. Stationery-class (letterhead/email) waits for the
stakeholder review. Mono/reversed mark variants near-free (mark is text-colored by design).

## Stories

1. `favicon-mark-tile` — replace the generic "S" tile: the brush-script mark at tile scale,
   cast60 dark / papyrus light variants, 16-48px legibility check (the mark is detail-heavy:
   verify at 16px — may need the slash-only reduction if the full lockup illegible).
2. `og-social-cards` — link-preview card template(s): mark + spine bg + title treatment,
   per-surface variants where cheap (home, press kit, live), 1200x630.
3. Mark usage notes (provisional, derived): clear-space from lockup geometry, mono/reversed,
   min-size — as a short reference doc in the design-system notes (org authors the real spec
   post-review).

## Operator decisions (2026-08-15, relaunch scope)

- og-cards carry **mark + name only — NO tagline** (option 2). The hero line "We boost the
  signal…" is unapproved copy and does not propagate to new surfaces; tagline slot added
  only when human-approved copy exists.
- Fraunces-for-auth ratified separately (applies to auth surfaces, not these assets).

## Implementation summary

- Replaced the generic favicon glyph with a theme-responsive papyrus/cast60 mark tile, using the
  slash-only reduction below 24px and a 5% safe area around the full 32px+ lockup. Committed
  light/dark 16px, 32px, and 180px raster fallbacks and advertised the full chain in root head.
- Added a deterministic Playwright generator and committed 1200x630 default, Records, and TV cards.
  Every card contains only the brush-script mark and its S/NC name treatment; no tagline or hero
  copy propagates. Root OG/Twitter metadata uses the default card while existing route-specific
  metadata remains authoritative.
- Added [`docs/mark-usage.md`](../../../docs/mark-usage.md) as explicitly provisional mechanical
  guidance for clear space, mono/reversed use, digital minimums, and favicon reduction. The
  organization remains responsible for the post-stakeholder-review brand/trademark specification.
- Visual verification: exact Chromium favicon renders at 16/32/48/180px in both schemes passed the
  final vision review after its first pass exposed and prompted the full-mark safe-area correction;
  the built default OG card independently passed vision review for content, hierarchy, clipping,
  spacing, and contrast.
- Integrated verification: OG generation is hash-stable across consecutive runs; PNG dimensions,
  source/head assertions, and served SSR icon/OG links passed; `bun run --filter @snc/web test`
  passed 197 files / 2057 tests; `bun run --filter @snc/web build` passed.
- Review weight: standard (project default); implementation stops at the requested feature review
  boundary.

## Review — standard pass (2026-08-15)

Cross-model fresh-context (GLM-5.2 host → GPT-5.6 Sol): **needs fixes → fixed → done.**
One blocker: global og:image dimensions survived route-level image overrides under
TanStack's per-property dedup (misdescribing arbitrary-size avatars/thumbnails on five
routes). Fixed by removing the root dimension declarations (scrapers measure
dimensionless og:images; lying dims are worse than none) + a merged-head regression
contract test. Governance findings all clean on inspection: no unapproved copy in any
asset (generator source + PNGs inspected), favicon chain consistent byte-exact vs
Chromium renders, no unrelated scope. Nit noted: og generator hardcodes spine/accent
values (re-derivation tool — regenerate on value swap; drift risk accepted and documented).
