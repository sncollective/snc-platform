---
id: press-vertical-card-alignment-grammar
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

# Card alignment grammar: top-aligned text + stretched pictures (operator round 5)

Operator finding: highlight eyebrows/titles out of vertical alignment across
cards (the `align-items:center` from round 3 centered each picture on its own
ragged text — within-card consistency at the cost of across-card alignment),
and 2-line descriptions running past the fixed-square pictures.

## The grammar (applied to highlights AND members — same stated principle)
- Text blocks TOP-ALIGNED: eyebrows/titles/names share the same y across
  every card in a row.
- Pictures STRETCH to the shared row height (equal on all cards in the row,
  with a min-height floor at the base size): a 2-line description or bio is
  contained by its grown picture instead of running past it.
- Density tiers resize the figure WIDTH (+ the grid column) only.

## Implementation notes
- Files: `apps/api/src/services/press-pdf.ts` only (vertical card CSS;
  horizontal cards keep their approved fixed squares).
- Measured: highlight eyebrows y=734/734, titles y=758/758, thumbnails equal
  67×83 with the 2-line description contained (2px margin); members
  name/role rows aligned, LeAnna's 2-line bio contained; listen balance
  21/17 (2px off section center); all regressions clean.
- Content observation relayed (not this story's scope): the current seed's
  vertical pair renders OUT NOW + STANDOUT TRACK — This Hell sits third and
  is dropped by the 2-card cap, the ordering the campaign traded in an
  earlier round. Campaign/operator content-lane call.
- Adjacent: none.
