---
id: press-rail-caption-and-filter
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

# Rail caption muting + filter lift (operator rulings)

Two operator styling rulings on the vertical one-sheet rail, resolving the
parked rail-fade flag:

1. **On-photo credit caption muting** — figcaption ('Ariana Cord') reads
   stark white; mute to ~82% opacity (element-level, keeps the text-shadow,
   checker-safe) across the shared caption rule (rail + horizontal hero —
   same pattern, consistent treatment). The footer photographyCredits line
   is explicitly fine as-is.
2. **Rail filter lift** — from `saturate(.46) contrast(1.08)
   brightness(.48)` (crushed) to `saturate(.60) contrast(1.08)
   brightness(.60)` per operator "a little bit" + campaign's suggested
   start. Bottom-fade gradient extent judged with fresh eyes on the lifted
   render — shrink from 28% if it still reads slab-like.

## Acceptance
Vision-verified: caption muted but legible over photo; rail visibly less
crushed; fade judgment recorded (and gradient tuned if needed).

## Implementation notes
- Files: `apps/api/src/services/press-pdf.ts` only — figcaption `opacity:.82`
  (element-level, checker-safe, shadow retained, applied to the shared caption
  rule = rail + horizontal hero consistently), rail filter
  `saturate(.60) contrast(1.08) brightness(.60)`, fade extent 28% → 19%.
- Verification (two vision passes): caption measured ~82% white over black
  (209/255 peak) — softened, legible, KEEP; filter judged recovered-but-moody
  (middle-third mean luminance 31/255 vs 1-3 in the void) — KEEP; fade judged
  improved at 19% (texture retained y770-900) with the residual void confined
  to the bottom ~7% — which is the caption's required dark bed; two adjacent
  verifier reads bracket "sufficient" vs "still slabby". Landed at 19%:
  further shrink trades the sweep for a hard band and risks the caption bed.
  Operator's eye rules on preview.
- Typecheck + unit 32/32; live renders single-page, zero regressions both passes.
- This resolves the parked rail-fade flag (about-secondary gray remains parked).
