---
id: creator-press-page-v2-editor
kind: feature
stage: drafting
tags: [creators, content, ui]
parent: creator-press-page-v2
depends_on: [creator-press-page-v2-content-model, creator-press-page-v2-image-management]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-07
---

# Press page v2 — editor

## Brief
The authoring surface (`/creators/<handle>/manage/press`), rebuilt for the v2
content model: manage **members** (name/role/bio/photo), **highlights** (with
cover art), the **gallery** (carousel source), the **template** pick (A/B),
For-fans-of, section images, and per-image **credits**. Uses the image-management
pipeline (upload → size-range accept → crop picker → credit). Fixes the v1
photo-editor defects via that pipeline.

## Epic context
- Parent epic: `creator-press-page-v2`
- Position: consumer of the content model + image-management; the authoring
  surface for everything the templates render.

## Simplification opportunity
- Replaces the v1 editor (flat fields, broken photo flow) with the structured
  v2 editor.
- The v1 editor's ~20 `useState` cells (a scan finding) — model v2 state more
  cohesively (typed reducer / section-owned state) in the design pass.

## Foundation references
- v1 editor: `apps/web/src/routes/creators/$creatorId/manage/press.tsx` (+ the
  v1 `manage/join.tsx` pattern it mirrored)
- `.mockups/design-system/tokens.css`

## Mockups
- **LOCKED (operator sign-off 2026-08-09):** `.mockups/screens/creator-press-page-v2-editor/option-2.html`
  — tabbed workbench (About / Members / Highlights / Links & contact / Appearance &
  media), with a **draft/publish model**, cross-tab error summary, image ownership
  fixed (entity images in their editors; Appearance & media = asset overview with
  deep-links + empty states), aspect-correct crop preview, and full WAI-ARIA tabs.
  (The 4-up IA exploration + the round-1 alternatives are alongside it for reference.)
- Inherits `.mockups/design-system/tokens.css`.

## Design decisions (operator, 2026-08-09)
- **Draft/publish model (operator chose (b)):** the editor stages changes to a
  **DRAFT**; the live press page + PDF read **PUBLISHED**; a Publish action copies
  draft → published. This implies a content-model/schema change — a `draftContent`
  alongside the live `content` on `creatorPressConfigs` (feature-design scopes this).
- **Brand-color setter lives here:** the editor is where the creator sets
  `creatorProfiles.brandColor` (a site-wide profile field; the PDF Creator Accent
  scheme + future surfaces consume it).
- **PDF-scheme picker** (Light / Dark / Creator Accent) in the Appearance & media tab.
- Tabbed IA over a single long form; Members/Highlights especially justify tabs.
