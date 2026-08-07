---
id: creator-press-page-v2-content-model
kind: feature
stage: drafting
tags: [creators, content, ui]
parent: creator-press-page-v2
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-07
---

# Press page v2 — content model

## Brief
The v2 content schema + migration, replacing the v1 flat shape. Adds: `members[]`
(name / role / bio? / photo), images as objects `{ key, alt, credit }` (band
photo, member photos, highlight cover art, gallery), `gallery[]` (carousel
source), merged `highlights[]` (the current single + standout track + optional
extras like the upcoming LP, each with cover art + streams figure), a `template`
selector (A/B), and For-fans-of placement (in About). Includes the Drizzle
migration + backward-compat with the live v1 `creator_press_configs` content
(v1 fields map forward; v1 pages keep rendering until v2 templates ship).

## Epic context
- Parent epic: `creator-press-page-v2`
- Position: **foundation feature** — the shared Zod contract + table shape every
  other v2 feature consumes (image-management, templates, editor, PDF).

## Simplification opportunity
- Retires the bare-key `photos: string[]` (and the scan finding about missing
  alt text) → images become `{ key, alt, credit }`.
- Merges the v1's separate `standoutTrack` + the release one-sheet into the
  unified `highlights[]` (one flexible list instead of two special-cased fields).

## Foundation references
- `packages/shared/src/press.ts` (v1 contract — the v2 supersedes)
- `apps/api/src/db/schema/creator.schema.ts` (`creator_press_configs` table)
- `.mockups/design-system/tokens.css` (design system the v2 inherits)

## Mockups
- Inherits design system: `.mockups/design-system/tokens.css`
- Content shapes reflect the locked templates: `.mockups/screens/creator-press-page/final-{1,3}.html`
