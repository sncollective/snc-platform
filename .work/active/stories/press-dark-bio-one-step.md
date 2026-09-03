---
id: press-dark-bio-one-step
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

# About secondary text one step lighter on dark (operator ruling)

The dark spine has no text token between muted (#979BAC) and text (#E8ECF2),
so the step is `[data-theme="dark"] .v-bio{color:var(--color-text);opacity:.75}`
— effective ~#B4B7C0, one perceptual step lighter, subordinate to full text
(8.4:1 on cast60). Light exports unchanged (muted reads fine on paper).
Scoped to the export CSS; a systemic --color-text-secondary token remains the
durable answer if a second consumer appears (token-ownership discipline, not
a one-liner).

## Implementation notes
- Files: `apps/api/src/services/press-pdf.ts` only.
- Verified: sampled glyph RGB (179,183,191) vs fan-line (151,155,172) vs
  headings (232,236,242) — exactly one step; comfortable print legibility; no
  layout regression; light render 200 unchanged.
- Adjacent: none.
