---
id: press-vertical-pdf-typesetting-bugs
kind: story
stage: done
tags: [press, design-system]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-02
updated: 2026-09-02
---

# Vertical PDF typesetting bugs (operator direct report)

Operator's eye on the actual PDF caught what the campaign's flash-vision
passes confirmed-but-missed. All four findings root-caused and fixed:

1. **Highlight description cascade bug** — the vertical card selector is
   `.v-highlight`, but the description/metric rules were written
   `.highlight p` / `.highlight .metric` (horizontal-only match).
   Descriptions inherited the page-default ~16px Archivo, painting larger
   AND bolder than the 16px Barlow Condensed titles (measured 15-17px vs
   13px). This inflated the card row and — combined with the previous
   pass's `align-content:center` compensation — produced the off-center
   thumbnail. Fix: selectors extended to `.highlight p,.v-highlight p` /
   `.highlight .metric,.v-highlight .metric`; the centering compensation
   reverted (top-aligned cards).
2. **About secondary legibility** — 10px Archivo measured word gaps 1-4px
   with near-touching letters. Fix: 11px, line-height 15 (net-zero block
   height), letter-spacing .015em.
3. **Margin asymmetry (50 top / 31 bottom)** — phantom height: the inflated
   descriptions pushed the copy column ~17px past the content box, painting
   through the bottom padding; the rail stretched with it. Fix #1 reclaims
   the height — margins now measure exactly 50/50.
4. **Fit-check blind spot (hardening)** — in-flow content painting into
   bottom padding does not grow scrollHeight, so the single-page fit check
   passed while the bottom was cramped. `assertSinglePageFit` now also flags
   in-flow content below the padding floor (absolute-positioned chrome like
   the release sheet's anchored footer exempt by design).

## Implementation notes
- Files: `apps/api/src/services/press-pdf.ts` (3 CSS fixes),
  `apps/api/src/services/browser-pdf.ts` (padding-floor assertion).
- Verification: typecheck + full unit (70/70 incl. press suites) +
  integration (11/11 — the hardened fit check runs against every real
  render in the suite, no false positives); live re-render passes the
  hardened check; measurement pass: titles 13px vs descriptions 9px (44%
  larger), both thumbnails top-aligned 10px below rule, About 11px/3px
  regular gaps, rail 50/50 symmetric, bottom clearance 51px, no
  regressions (QR 2px from label top, contacts intact).
- Process lesson recorded: font-size cascade bugs are invisible to
  "looks on-brand" vision checks — the flash passes confirmed centering
  behavior without noticing the description was the wrong type size.
  Measurement-first verification (painted heights, offsets) is what caught
  it; keep that the default for typesetting claims.
- Adjacent issues parked: none new (the three operator taste flags remain
  parked separately).
