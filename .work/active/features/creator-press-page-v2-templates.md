---
id: creator-press-page-v2-templates
kind: feature
stage: drafting
tags: [creators, content, ui]
parent: creator-press-page-v2
depends_on: [creator-press-page-v2-content-model]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-07
---

# Press page v2 — templates (A + B + selector)

## Brief
The public press-page rendering layer, per the locked design. Two selectable
templates: **Template A — Clean editorial** (single-column; members WITH bios)
and **Template B — Two-column zone** (denser; members names-only; three
highlights). A `template` selector renders the chosen one. Both share the locked
layout: text-on-image header (wordmark aligned to the article column, full-bleed
3:1 banner) → About (deck+body bio, no toggle) + For-fans-of → Members →
Highlights (cover art) → Live dates → Listen (streaming-service **icon buttons**)
→ Gallery (**carousel**, at the bottom) → Footer (press email + Download PDF).

Live dates: render the list; the Bandsintown **data source** is the separate
`bandsintown-integration` epic — until it lands, link out to Bandsintown.

## Epic context
- Parent epic: `creator-press-page-v2`
- Position: consumer of the content model; the PDF feature reuses this rendering.

## Simplification opportunity
- Replaces the v1 single hardcoded layout with the selectable template system
  (the `template` selector is the seam for future templates — this ships A + B).

## Foundation references
- v1 page: `apps/web/src/routes/creators/$creatorId/press.tsx`
- `.mockups/design-system/tokens.css`

## Mockups
- **LOCKED** — `.mockups/screens/creator-press-page/final-1.html` (Template A),
  `final-3.html` (Template B), `final-index.html` (comparison). Signed off
  2026-08-07. Implement to these references.
