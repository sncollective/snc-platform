---
id: press-slack-distribution-and-bio-size
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

# Uniform slack distribution + member bio font bump

Operator: parked negative space between the live-dates rule and the QR;
asked whether LISTEN was oversized/bottom-aligned (it wasn't — QR-driven
height, text centered) and requested distribution so no section carries a
pool. Also: room for larger member bio lines?

## Root cause and fix
- The pool was the vertical body's page-buffer spacer (flex:1) absorbing
  all column slack — a round-4 mechanism that outlived its purpose once the
  template pinned. FIRST removal attempt silently failed (unasserted string
  replace) and the verification pass correctly reported the distribution
  FAIL; second attempt removed it for real.
- Fix: vertical page-buffer and v-actions-spacer deleted; `.copy` gains
  `justify-content:space-between` — slack distributes uniformly across all
  seven section boundaries; footer (last child) stays pinned to the page
  bottom. Horizontal sheet untouched (its spacer serves its own pinned
  rhythm).
- Member bios 9px/11px → 10px/12px (budget confirmed by the measured pool):
  painted 10px, all four contained (Connor tightest at 4px), LeAnna's
  2-line wrap clean.

## Verification
- Section gaps: median 27px, range 24-30, max/median 1.11× — uniform
  cadence, no outlier (former pool was 91px vs 15px cadence).
- Footer pinned; QR/text centered at y967 both; highlight squares 78×78;
  single rules; 50/50 margins; single page; typecheck + unit 34/34.
- Process lesson recorded: assert every programmatic replace; measurement
  verification catches what confidence misses.
