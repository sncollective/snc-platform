---
id: press-vertical-footer-rhythm
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

# Vertical one-sheet footer rhythm (operator direct report, round 2)

Three operator findings on the vertical PDF footer, all confirmed and fixed:

1. **Large label→value gap + stacked contacts** — vertical contact block
   restructured to inline baseline pairs on one wrapped row
   (`PRESS press@s-nc.org · BOOKING booking@s-nc.org`), 4 stacked lines → 1;
   label→email gap structurally eliminated (same-line baseline, measured 0px
   stacking / 9-10px horizontal).
2. **Double rules between live-dates/listen** — `.v-actions` border-top
   removed; `.v-live` border-bottom is the single separator. Listen→contact
   keeps its single rule. Lower third now 3 evenly singular rules.
3. **Listen text top-clumped vs QR** — text div stretches to the row
   (align-items:start reverted on `.v-listen`) and centers internally;
   measured exactly 16px above / 16px below against the 83px QR.

## Implementation notes
- Files: `apps/api/src/services/press-pdf.ts` (vertical footer CSS + inline
  contact markup), test assertion updated to the inline markup.
- Side effect worth recording: the contact-row height savings (post
  quote-withdrawal) dropped the vertical sheet from compact back to
  **normal** density (thumbnails ≈50px CSS) — the parked "normal-tier
  rhythm" operator flag resolves itself with current content volume.
- Verification: typecheck + unit 31/31; live render single-page, hardened
  fit check green; two measurement passes (first caught the centering
  miss — align-items:start prevented stretch — fixed and re-verified 16/16).
- Adjacent issues parked: none.
