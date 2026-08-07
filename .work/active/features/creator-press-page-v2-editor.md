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
- **UI alignment DEFERRED to this feature's design pass** (feature-design
  Phase 4.6 fallback). The public press page is mocked (final-1/3); the editor
  form is a substantial redesign (members/highlights/gallery/template picker/
  image-crop) that warrants its own mockup when this feature is designed.
  Inherits `.mockups/design-system/tokens.css`.
