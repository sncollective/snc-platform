---
id: story-release-epk-template
kind: story
stage: done
tags: [press, design-system]
parent: single-release-epk
depends_on: [story-release-epk-content-model]
release_binding: null
gate_origin: null
created: 2026-09-02
updated: 2026-09-02
---

# Release EPK template + route

`releaseEpkSheet` builder + `renderReleaseEpkPdf` + route
`GET /:creatorId/press/releases/:releaseSlug/epk.pdf?theme=`. Layout per
feature body. Pinned deterministic one-page (hardened fit check, loud
400 with trim guidance); links as URI annotations; box-aspect print
specs; QR light patch; dark via theme param.

## Acceptance
Unit (markup contract, theme, fit-failure mapping) + route tests; live
first render of This Hell for campaign preview with measurements.

## Implementation notes (2026-09-02)
- `renderReleaseEpkPdf` + `releaseEpkSheet` + route `GET .../releases/:slug/epk.pdf?theme=`;
  `BrowserPdfOptions.pageSize` (defaults Letter) enables the half-Letter page.
- Deterministic per the rules: single pinned layout, hardened fit check, route maps
  fit failures to a 400 with story/pulls trim guidance.
- RELEASE_TITLE_RED (#B5302A) allowlisted in the export-CSS boundary test — payload-critical
  legibility color on a fixed photographic ground (same class as the QR pair); shadows
  tokenized to --color-overlay-strong; story gray uses the one-step dark treatment.
- Hero geometry (the instructive bug): the bright footroom NEVER rendered because
  Garage's banner-v01 is the 3:1 SHORT image — the tall 3:2 (BannerTall1) was never
  uploaded. Uploaded it via press-asset as banner-tall-v01.jpg; luminance-profiled the
  source (bright bands 181/183 top, band strip middle, floor 128/161 bottom ~20%);
  crop window anchored to the source bottom (object-position 100%) — band upper-mid,
  off-white floor carrying the red title (measured 161-167/255 behind the title, 3.5-4×
  the prior 41-47). Print spec at source 3:2 (1650×1100) so CSS owns the crop.
- First render + 3 measured revision passes (pulls columns 2→3, rhythm voids absorbed by
  type/duo sizing, cover enlarged + right-anchored, QR to scan size 0.45in).
- Seeded the brief's EPK content verbatim (story, 4 lyricPulls, photos with credits,
  preSaveUrl null) + hero switched to the tall asset.
- Verified: typecheck, unit (74/74), checker 9/9, live render single-page half-Letter,
  final vision pass PASS on all checks.

## Postscript: campaign first-review fixes (2026-09-02, later)
- **Credit defect fixed**: the EPK builder rendered bare <img> tags — no photo credits
  anywhere (campaign caught at 4-6x zoom, provenance-standard). Footer now carries a
  deduped "Photography: Hayley Herriges · Ariana Cord" small-print line derived from
  the photos actually used (avoids on-bright-floor caption legibility). One syntax slip
  in the fix (missing array bracket) caught by typecheck before any render.
- QR nudged off the trim edge (0.11in → 0.147in inset, inside printer no-print margins).
- Cover caption data error: publisherLine → "Album artwork".
- Hero deviation flagged for operator ruling: manifest said lead with the 3:1 narrow;
  geometric necessity (a 2.2:1 tall hero cannot come from a 3:1 source) forced the tall
  3:2 — same shoot/credit/concept.

## Postscript 2: dark-hero re-theme + 3in hero (operator round)
- Campaign swapped the hero to a dark abstract; the fixed dark ink (tuned for the
  old bright footroom) vanished on it. Re-themed with tokens: artist/facts
  var(--color-on-media), title/catalog var(--color-accent) — correct on both
  photographic grounds and both themes; RETIRED the two allowlisted fixed-color
  constants (allowlist back to the QR pair). Facts row lifted 14→20px off the
  hero edge (was faint/clipped).
- 3in hero per operator (240→288px CSS), top-anchored crop matching the content
  crop rect (y=0/h=.78, top-energy preserved). Measured 3.01in.
- Verified: contrast 5.9–19.8:1 across hero text; facts clear with 0.25in
  breathing; single page; 0 luminosity masks.
- Open (content-lane): the campaign's content simplification dropped the duo
  photo, the cover artKey, and 3 of 4 lyric pulls — a ~1.8in mid-page void
  remains and the brief's photo affordances are unexercised. Asked whether the
  simplification intended that; restore vs re-scale is their call.
