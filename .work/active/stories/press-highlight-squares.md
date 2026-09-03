---
id: press-highlight-squares
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

# Highlight pictures as true squares (operator rounds 6-7)

Operator: stretched pictures landed ~5-11% taller than wide; questioned
width-stretch vs height-trim; observed the picture outrunning the text ink.

## The arc (recorded for the debrief)
1. Uncapped `aspect-ratio:1` + auto column → feedback loop (taller row →
   wider picture → narrower text → more lines) until the hardened fit check
   correctly 400'd. Bounded with max-width — browser auto-column resolution
   under stretch still landed short (71px).
2. Fixed-width + stretch-to-row: faithful to the text's LINE-BOX stack, but
   line boxes include leading the eye reads as slack → persistent ~11%
   portrait at every tier. A width bump and a stack trim both failed to
   close it (the trim flipped the sheet back to normal tier, same ratio
   one tier up).
3. Landing: **deterministic fixed squares** — 80×80 base / 74×74 compact /
   60×60 tight, top-aligned text, no stretch. The square is sized to contain
   the common text ink; line-box slack below becomes invisible card
   whitespace. Measured 84×85 (1.2%, raster rounding), 3-line description
   contained flush (0px margin — acceptable; a one-word content trim would
   buy breathing room, campaign lane).
- Stack trims retained (h2 margin-top 0, line-height 19, desc margin 2px).
- Verification: typecheck + unit 32/32; live render single-page; measurement
  passes at each step; no regressions.
- Lesson: stretch-based sizing chases line boxes; fixed geometry sized to
  ink is predictable. The fit check caught a real runaway — hardening paid
  for itself same-day.
