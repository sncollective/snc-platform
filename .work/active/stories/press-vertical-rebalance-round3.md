---
id: press-vertical-rebalance-round3
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

# Vertical one-sheet rebalance round 3 (operator direct report)

Four findings; measurement-first as established:

1. **Listen section blank** — measured: QR/text mutually centered exactly
   (16/16); the blank band above is the copy column's flex spacer
   (page-buffer) pinning the footer to the bottom with the content
   under-filling. Not a defect — the slack is the slot for member bios
   (below). Consumed when the campaign seeds 1-liners.
2. **Highlight figure/text inconsistency** — measured: cards identical in
   rule/thumbnail/eyebrow/title alignment; the inconsistency was the
   within-card relationship (left text 13px below its thumbnail; right
   thumbnail 11px below its text). An attempted tighter description cap
   (52 chars) was wrong — ineffective at column width and editorially
   lossy; reverted. Fix: `align-items:center` on the card grid — the
   thumbnail centers on its text block in every card regardless of text
   height. Verified: left 0/0 flush, right 6/6 equal overhang — same rule
   both cards.
3. **Member 1-liners on vertical** — `renderMember` vertical branch now
   renders `member.bio` (truncated 60 chars) as `.v-member-bio`
   (9px/11px muted). Campaign seeds the copy.
4. **Photography credits font** — 7.5px had the same cramped-tracking
   class as the old About issue; now 8px + letter-spacing .015em.
   Verified regular/discreet.

## Implementation notes
- Files: `apps/api/src/services/press-pdf.ts` only (render + CSS).
- Verification: typecheck + unit 32/32; live render single-page; measurement
  pass verifies all four; no regressions (rules, contacts, margins 50/50).
- Adjacent: none.
