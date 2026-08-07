---
id: creator-press-page-v2-image-management
kind: feature
stage: drafting
tags: [creators, content, ui]
parent: creator-press-page-v2
depends_on: [creator-press-page-v2-content-model, content-library-core]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-07
---

# Press page v2 — image management & picker

## Brief
The image pipeline for the v2: upload that **accepts a size range** per slot
(doesn't reject), a **crop/section picker** so the user chooses the right portion
for each predetermined slot's aspect (banner 3:1, band photo, member photos,
cover art, gallery), per-image **credits** (stored on the image object, burned-in
on display), and the **photo-editor fix** — remove/replace actually changes the
image, the preview reflects local (unsaved) state, and removed objects get
garbage-collected (no orphans).

## Epic context
- Parent epic: `creator-press-page-v2`
- Position: consumer of the content-model image objects; the editor-v2 feature
  uses this pipeline.

## Simplification opportunity
- Fixes the live v1 photo-editor bug (remove→reupload doesn't change; preview
  reads saved config not local state; orphaned Garage objects on remove).
- Replaces the v1 bare-key photo handling + the indexed-stream endpoint with the
  object-based pipeline + crop picker.

## Foundation references
- v1 photo path: `apps/api/src/routes/press.routes.ts` (photo upload/stream),
  `apps/web/src/routes/creators/$creatorId/manage/press.tsx` (editor photo UI)
- Storage: `apps/api/src/storage/index.js`, imgproxy (`apps/api/src/lib/imgproxy.ts`)
- `.mockups/design-system/tokens.css`

## Mockups
- Image slots + gallery carousel as in `.mockups/screens/creator-press-page/final-{1,3}.html`
- The crop/section picker is a net-new component — design it in this feature's
  `feature-design` pass (likely a library: react-image-crop or equiv.; research
  in feature-design).
