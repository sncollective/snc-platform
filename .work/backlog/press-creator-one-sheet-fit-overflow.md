---
id: press-creator-one-sheet-fit-overflow
kind: story
stage: backlog
tags: [press]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-02
updated: 2026-09-02
---

# Creator one-sheet fit check rejects real-content volumes

`GET /api/creators/:id/press/one-sheet.pdf` 500s with "Press one-sheet does
not fit one page: vertical content overflow" against the real Animal Future
press config (4 members, 3 highlights, tagline, 2 releases — the seeded
`seed-press.ts` content, no images). Both `orientation=auto` and
`orientation=horizontal` fail. Found while generating the cycle-2 press PDFs
via the local endpoints (2026-09-02): `one-pager.pdf` and the per-release
`one-sheet.pdf` render fine; only the creator one-sheet hard-fails.

The one-page guarantee is the right invariant, but a 500 on plausible real
content is a dead end for the surface most likely to carry it. Options to
weigh at scoping: graceful density scaling (type/leading compression tiers
before failure), trimming strategy (drop lowest-priority sections at render
time with a visible indicator), or a 422 with a field-level overflow report
the editor can act on.

Release one-sheet unaffected (renders sparse-but-clean at current volume).
