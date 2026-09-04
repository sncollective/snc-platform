---
id: single-release-epk
kind: feature
stage: done
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

## Design (2026-09-02, from the campaign content brief)

**Shape: story-led one-pager.** The pitch copy is the spine; the template
gets out of its way. Deterministic from day one (rule 1): one pinned
layout, loud 400 on overflow, no ladder ever.

### Layout (platform discretion per operator; ships with 3 images)
1. Mast: `S/NC RECORDS · SINGLE EPK`
2. Hero band: `banner-v01` (Herriges) full-width ~2in with gradient overlay;
   release title large display + facts block right (catalog/date/duration)
3. Story: the pitch verbatim; its opener lyric pull rendered as a display
   pull-quote integrated into the copy flow (the zine instinct already
   inside the copy)
4. Lyric pulls strip: remaining marked pulls in display face with accent
   rules (2-3)
5. Support row: duo live photo (box-aspect print spec) + cover art (fixed
   square, artKey) + track facts/credits rows (release-sheet grammar)
6. Footer: inline contacts (press + booking), destinations links (URI
   annotations), preSaveUrl when live (else linktree), QR on light patch,
   photography credits small print

### Content model (per-release, strict publish / permissive draft)
- `story` (long text) · `lyricPulls: string[]` · `photos: PressImage[]`
  (2-4; cover art stays `artKey`) · `preSaveUrl` (smart link)

### Decomposition
- `story-release-epk-content-model` — schema fields at all sites + editor
  release section + validation + fixtures
- `story-release-epk-template` (depends on content model) — sheet builder,
  render function, route `GET .../releases/:slug/epk.pdf?theme=`, pinned
  one-page + loud overflow, tests, first render for campaign preview

Campaign lanes: seed copy/photos (assets already staged), preview + vision
passes with measurements. Dropped-photos list (LeAnnaShow1, JarodConnor1)
is recorded campaign-side as operator taste.

## Integrated feature review (2026-09-03, via press-support-branch-reconciliation)

Both child stories done (content model, template). The finish rounds —
eleven additional commits mapped in the reconciliation item — are
documented across the template story's four postscripts. Integrated
verification: the live artifact rendered and measured-verified dozens of
times through the session (hero modes, credit ledger, pre-save, optical
alignment, viewer-proof construction, WYSIWYG geometry); suites green
throughout. The feature advances to done with the reconciliation review
as its review record.
