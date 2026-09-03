---
id: single-release-epk
kind: feature
stage: drafting
tags: [press, creators, content, ui]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-02
updated: 2026-09-02
---

# Single-release EPK

Operator direction (2026-09-02, opening the next arc): a per-release EPK
artifact — richer than the current release one-sheet (text + cover art),
in the vein of the branding/template work from the press-support arc, with
content and photos driving the shape more than platform structure. The
animal-future campaign agent is being prepped to lead content.

## Inherits the press-support rules of thumb (established 2026-09-02)
1. **One deterministic template** — pin density from day one; over-budget
   content 400s loudly with trim guidance; no auto-retiering.
2. **Alignment grammar** — text top-aligned across cards; fixed squares for
   square art; box-aspect print specs (no square middlemen).
3. **Uniform slack distribution** — space-between cadence; no parked pools.
4. **Measurement-verified changes** — both lanes; vision passes carry
   measurement instructions when hierarchy/spacing is in question.
5. **Assert programmatic replaces** — unasserted edits have silently
   failed twice this arc.
6. **Links resolve** — every named surface (streaming, live, listen) is a
   URI annotation in the PDF.
7. **Provenance discipline** — quotes/credits verbatim-verified at source;
   band-authored material never attributed as editorial praise.
8. **Dark voice via ?theme=dark**; QR stays on its light patch.
9. **Content caps self-bound** — any unbounded field (quotes) is the
   overflow dial; document it per template.

## Open design questions (feature-design pass or operator-driven rounds)
- Section inventory and order; one page or two (EPKs often run 2 — the
  one-pager pagination precedent allows it).
- Base layout: extend the release one-sheet, reuse the vertical one-sheet
  grammar, or fresh composition.
- Content model: release-scoped quotes/photos (per-release fields on
  releases[], or new slots?) vs creator-level fields. pressQuotes is
  currently creator-scoped.
- Which existing fields drive first (cover art, destinations links,
  press/booking contacts, photographyCredits are all live).
