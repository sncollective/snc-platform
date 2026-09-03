---
id: press-drop-vertical-folio
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

# Drop the vertical one-sheet folio (operator ruling)

Operator ruled to drop the `S/NC · 01/01` folio (print-folio convention
that read as a date). Removed the span and its now-dead CSS rule; the
v-contact row simplifies to the inline contacts alone (flex left-aligns).

## Implementation notes
- Files: `apps/api/src/services/press-pdf.ts` only.
- Verification: typecheck + unit 32/32; live render 200; footer small print
  now consists of the photography-credits line alone.
- Adjacent: none.
