---
id: press-vertical-member-listen-balance
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

# Member-card alignment + listen-section vertical balance (operator round 4)

Two findings, same diseases as round 3 — treated with the now-established
rules:

1. **Member text bleeding past pictures** (2-line bios vs 48px thumbnails) —
   `.v-member` gains `align-items:center`: the portrait centers on its text
   block, mirroring the approved highlight-card rule. Measured: all four
   cards ≤1.5px center delta, one shared rule.
2. **Listen section top/bottom imbalance** (slack pooled above from the
   footer-pinning buffer) — `.v-actions` becomes a flex column with its own
   growable spacer between listen and contacts, splitting the copy column's
   slack evenly around the listen block. Measured 47/17 → 26/17; residual
   9px traced to fixed-padding asymmetry (actions padding-top vs contact
   margin) — closed by weighting the outer buffer's flex share to .5.
   QR/text mutual centering exact throughout.

## Implementation notes
- Files: `apps/api/src/services/press-pdf.ts` only.
- Verification: typecheck + unit 32/32; live renders single-page; measurement
  pass (members exact, listen 26/17 → tuned to ~parity by arithmetic on the
  measured fixed paddings); zero regressions (contacts, credits, rules,
  margins, bios intact).
- Adjacent: none.
