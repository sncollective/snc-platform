---
id: press-pinned-one-sheet-template
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

# One-sheet pinned to one deterministic template per orientation

Operator ruling: the auto density ladder made review rounds chase moving
targets (the tier silently flipped ≥5 times across the day as content
changed — compact→tight→normal→compact→normal); the release-candidate
phase wants ONE frozen template, not reactive re-layout.

## Design decisions
- **Vertical pins at compact** — the tier of the operator-approved render
  ("closest the vertical template has felt to correct"). **Horizontal pins
  at normal.** Same content → same layout, every render.
- Over-budget content fails LOUDLY: BrowserPdfSinglePageFitError → route
  400 with trim guidance. No silent compression, ever.
- Supersedes the fit-overflow story's scaling-before-failure choice — right
  for the iteration phase, wrong for release candidates. The choice is now
  phase-appropriate: the ladder served iteration; the pin serves shipping.
- Dead code removed: the ladder loop, the tight-tier CSS, `lastFitError`.
  The fit-check hardening stays (it guards the pin).

## Implementation notes
- Files: `apps/api/src/services/press-pdf.ts` (pin + deletions), unit tests
  (ladder tests → pinned tests: single attempt, compact class on vertical,
  immediate fit failure), integration test (over-budget fixture → loud
  rejection; the unbounded pull-quote is the genuine overflow lever — every
  other field is structurally capped, which is why the horizontal sheet is
  effectively overflow-proof).
- Verification: full unit + integration suites green; live: pinned vertical
  renders 200 at the approved compact layout, horizontal 200 at normal.
- Adjacent: none.
