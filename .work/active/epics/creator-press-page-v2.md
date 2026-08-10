---
id: creator-press-page-v2
kind: epic
stage: review
tags: [creators, content, ui]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-10
---

# Creator press page v2 — template system + richer content model

## Brief

The v1 press page (`creator-press-page`, shipped in 0.4.0) went out without a
design pass. We ran the mockup iteration (Aug 2026) and locked **two templates**
(reference: `.mockups/screens/creator-press-page/final-{1,3}.html` + `final-index.html`):

- **Template A — Clean editorial** (single-column; members WITH one-line bios).
- **Template B — Two-column zone** (denser; members names-only; three highlights).

This epic implements the v2: a selectable template system + a richer content
model + proper image management + editor + PDF, per the locked design.

## Locked design

Text-on-image header (wordmark aligned to the article column; full-bleed 3:1
banner) → **About** (short bio as a deck/standfirst + long bio as body, NO
toggle) + **"For fans of"** pills → **Members** (name/role/photo, optional
one-line bio) → **Highlights** (merged: current single + standout track +
optional extras like the upcoming LP, each with cover art) → **Live dates**
(Bandsintown list — data source is a *separate* epic; until it lands the page
links to Bandsintown) → **Listen** (streaming-service ICON buttons) → **Gallery**
(carousel, at the bottom) → **Footer** (press email + Download one-pager PDF).

Images are objects `{ key, alt, credit }` (retires the bare-key `photos[]` and
the alt-text scan finding). Each image slot accepts a size **range**;
non-conforming uploads get a **crop/section picker** (per-slot aspect). Per-image
**credits** render as burn-in overlays (web + PDF).

## Decomposition

Split by capability: the content model is the foundation (every feature
consumes its types); image-management is the pipeline the editor uses; templates
is the rendering layer (the locked design); the editor consumes content-model +
image-management; the PDF reuses the template render. The photo-editor bug fix
rides in image-management (can be lifted as a quick standalone if the live
editor needs it before the full v2).

### Child features

- `creator-press-page-v2-content-model` — shared schema + migration (`members[]`,
  image objects `{key,alt,credit}`, `gallery[]`, merged `highlights[]`,
  `template` selector) — depends on: `[]`
- `creator-press-page-v2-image-management` — size-range upload + crop/section
  picker + credits + photo-editor fix — depends on: `[content-model, content-library-core]`
  (cross-epic: `content-library`)
- `creator-press-page-v2-templates` — Template A + B + selector + streaming
  icons + carousel gallery, per the locked design — depends on: `[content-model, image-management]`
  (the design proceeds in parallel; implementation consumes image-management's
  crop-aware server-side delivery helper)
- `creator-press-page-v2-editor` — manage members/highlights/gallery/template/
  credits via the image pipeline — depends on: `[content-model, image-management]`
- `creator-press-page-v2-pdf` — render the chosen template to letter-size —
  depends on: `[content-model, templates]`

### Simplification arcs

- content-model — retires bare-key `photos[]` (+ alt-text scan finding); merges
  standout + release into unified `highlights[]`.
- image-management — fixes the live photo-editor bug; replaces the indexed-stream
  endpoint with the object pipeline + crop picker.
- templates — replaces the v1 single layout with the selectable template system.
- pdf — one template render serves web + PDF (replaces the duplicated @react-pdf doc).

### Decomposition risks

- Templates + editor are the larger features (~10–15 units); feature-design may
  split them further. Templates is designed in parallel with image-management,
  but its public route integration waits for image-management's crop-aware
  server-side delivery helper so signing logic never enters the browser.
- The editor UI is NOT mocked (deferred to its feature-design pass) — it's a
  substantial authoring-form redesign; the press-page mockups cover the public
  surface.

## Mockups

Public press page — **LOCKED** (signed off 2026-08-07):
- `.mockups/screens/creator-press-page/final-1.html` (Template A — clean editorial)
- `.mockups/screens/creator-press-page/final-3.html` (Template B — two-column zone)
- `.mockups/screens/creator-press-page/final-index.html` (comparison)
- Design system: `.mockups/design-system/tokens.css`

Editor UI — deferred to the editor feature's design pass (feature-design
Phase 4.6 fallback). The public surface is aligned above.

## Out of scope (separate epic)

- **Bandsintown integration** (`bandsintown-integration`, parked) — server-fetch
  + cache the public API; reusable for press + creator pages. The v2 templates
  *render* the live-dates list; the data source is the separate epic. Until it
  lands, the page links to Bandsintown.

## Notes

- v1 stays live until v2 ships (no formal supersession; v2 replaces the press
  page + editor + PDF in place).
- The photo-editor bug (remove→reupload doesn't change) is a live v1 defect;
  the image-management arc fixes it. Can be lifted as a quick standalone if
  needed before the full v2.
- Two templates ship as "Template A / Template B" — the first of future
  selectable templates (the `template` selector is the seam).

## Epic aggregate review fix — 2026-08-10

The epic remains at `stage: review` for a fresh aggregate re-review. This closure
pass repaired the v1→v2 visibility regression and folded in the accepted
should-fix findings:

- Restored an explicit, confirmed **Unpublish · take offline** action. The API
  sets published `enabled: false`, retains (or creates from published content)
  the editable draft, and keeps republish on the existing Publish path.
- Exposed both PDF products in the editor and public page with distinct labels:
  **full press PDF** (`one-pager.pdf`) and **one-sheet PDF** (`one-sheet.pdf`).
- Added per-template highlight limits (A: 2, B: 3), an excess-content warning,
  and the one-sheet's orientation-dependent 2/3-item curation note.
- Clarified that brand color is a site-wide profile setting applied immediately
  on draft save, including Creator Accent PDFs; it is not draft-isolated.

### Implementation notes

- Execution capability: `openai-codex/gpt-5.6-sol`; cohesive epic-closure fix,
  implemented inline as requested with no nested subagents.
- Review boundary: stop at epic `review`; caller requested a fresh aggregate
  re-review after this fix.
- Files changed: press editor + styles; public press route, template download
  contract, templates, shared sections + styles; press API route + service;
  focused web/API regression tests.
- Tests added: unpublish route/service/editor behavior; dual PDF link contracts;
  highlight overflow warning; immediate brand-color copy.
- Simplification: replaced ambiguous one-pager UI wording with explicit full-PDF
  vs one-sheet contracts; no compatibility path retained for the internal prop.
- Discrepancies from design: none.
- Adjacent issues parked: none.

### Verification

- `bun run --filter @snc/web test` — 185 files / 1,910 tests passed.
- `bun run --filter @snc/web typecheck` — passed.
- Focused API unit tests — 2 files / 53 tests passed.
- `cd apps/api && npx tsc --noEmit` — passed with zero diagnostics.
- Firefox headless visual verification with fresh contexts at 1440, 1024, and
  390 px confirmed the unpublish control + confirmation semantics, distinct PDF
  links, highlight overflow warning, immediate brand-color note, and zero
  document-level horizontal overflow. Temporary profiles/screenshots were
  removed after inspection.
