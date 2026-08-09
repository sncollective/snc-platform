---
id: creator-press-page-v2-pdf
kind: feature
stage: drafting
tags: [creators, content, ui]
parent: creator-press-page-v2
depends_on: [creator-press-page-v2-content-model, creator-press-page-v2-templates, creator-profile-brand-color]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-07
---

# Press page v2 — PDF (render template to letter)

## Brief
The one-pager PDF becomes the **chosen template rendered to letter-size** (one
content source, not a separate @react-pdf document). The locked templates already
carry `@page letter` print CSS; this feature implements the save-to-PDF path so
the "Download one-pager (PDF)" action produces a faithful letter-size render of
the selected template (A or B), with the burn-in photo credits.

## Epic context
- Parent epic: `creator-press-page-v2`
- Position: consumer of the content model + templates; reuses the template
  rendering for the PDF output.

## Simplification opportunity
- Replaces the v1's standalone `press-pdf.ts` (@react-pdf one-pager) — which
  duplicated the layout in @react-pdf's dialect — with a single template render
  that serves both the web page and the PDF. (Feature-design decides the
  mechanism: headless print of the template vs. continuing @react-pdf with the
  template's layout; the goal is one source of truth.)

## Foundation references
- v1 PDF: `apps/api/src/services/press-pdf.ts`, `apps/api/src/routes/press.routes.ts` (.pdf endpoints)
- `.mockups/design-system/tokens.css`; the `@page letter` CSS in `final-{1,3}.html`

## Mockups
- **Full PDF (clean, web-matching):** the locked templates at print size —
  the `@page letter` + `@media print` rules in `final-1.html` / `final-3.html`
  (already shipped by the `creator-press-page-v2-templates` feature). This is the
  **MVP default** for this round.
- **Press 1-sheet (clean) — LOCKED (operator sign-off 2026-08-09):** two parallel,
  distinctly-designed single-page one-sheets (pick by lead-photo orientation) at
  `.mockups/screens/creator-press-page-v2-pdf-onesheet/`:
  - `option-1.html` — horizontal-lead one-sheet.
  - `option-2.html` — vertical-lead one-sheet (calmer/condensed: 1-para bio,
    members = photos + names + roles (no bios), 2 horizontal highlights).
  Built against `.claude/skills/print-design/SKILL.md` (grid/baseline/type floors);
  QR links a customizable URL (default = creator's linktree). Round-1 alternatives
  in `…/round-1/`.
- **Zine/edgy direction — PARKED (stretch goal):** `.mockups/screens/creator-press-page-v2-pdf/zine-stretch/`
  — a punkier PDF template, deferred to a later pass (the web templates stay the
  safe default; a punkier web template is also a future stretch goal).

## Design decisions (operator, 2026-08-08/09)
- **This round's MVP = the clean, web-matching PDF** (full + 1-sheet). The zine
  direction is held for another pass.
- **Two outputs:** a full press PDF (multi-page, the template's print output) AND
  a distinctly-designed **1-sheet** (curated single page — not a truncated full).
- **Color scheme** is a creator-pickable option on the clean template:
  Editorial Light / Dark (web-matching default) / **Creator Brand Accent**.
- **Brand color lives on the creator profile** (`creatorProfiles.brandColor`, a
  curated-palette field) so it's reusable site-wide; the Creator Brand Accent PDF
  scheme + future surfaces read it. The editor delivers the setter; the PDF consumes it.
- **QR destination** = a customizable URL (default = creator's linktree/link-in-bio,
  not bandcamp).
- **Per-release one-sheet** (e.g. AF's next single) is a near-term reuse of this
  print template system — the v1 already had `renderOneSheetPdf`; the v2 picks it
  up on the same grid/aesthetic. Not this feature's scope, but the template/
skill generalize to it.
- Mechanism (headless print of the template vs. continuing @react-pdf) is a
  feature-design decision; goal remains one source of truth for the render.
