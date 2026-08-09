---
id: content-library-page
kind: feature
stage: drafting
tags: [media, content, ui]
parent: content-library
depends_on: [content-library-core]
release_binding: null
gate_origin: null
created: 2026-08-09
updated: 2026-08-09
---

# Content library — creator media-library page (image MVP)

## Brief
The standalone creator page for browsing + managing their media library — a
filterable image grid/table in the **Notion-like database UX pattern** (dropdown
filters + property columns + grid/table views), defaulting to the current
creator's assets. **Image-only MVP, forward-compatible** with the parked
unified-media-library vision (video/audio + rich filtering extend the pattern later).

## Mockup (LOCKED, operator sign-off 2026-08-09)
`.mockups/screens/content-library-page/option-4.html` (simplified). The
round-1 alternatives (options 1–3) are alongside for reference.

## MVP scope (operator-confirmed — reduce to API-supported + meaningful)
**In scope:**
- **Source** filter: My library (DEFAULT = current creator) / Shared with me (empty at 1 creator, but the control + pattern land).
- **Sharing-scope** filter + a **read-only sharing badge** per asset (private/requestable/open). Sharing scope is SET AT UPLOAD (in the media picker), not edited inline here — defer inline edit + its endpoint to the unified vision.
- **Sort** by date / size.
- **Grid ↔ table** views (grid default for images; table for metadata comparison); property columns (dimensions, sharing, date, size).
- **Use-status badges** (own / open / granted / needs-permission) per asset.
- **Empty / loading / no-results** states (AF photos not delivered → empty is a likely first impression).
- Real filter STATE (selections actually filter results, show active chips + counts, Clear filters), real `ContextShell` geometry, full a11y (≥44px controls, semantic table/grid, ARIA, keyboard). [Build requirements from the adversarial review.]

**Deferred to the parked unified-media-library vision** (do NOT build for MVP):
tags, properties-search, owner-filter, inline sharing-edit, saved views, the
video/audio media-schema. The Notion-like filter *pattern* ships now so these
extend cleanly later.

## Foundation references
- `packages/shared/src/content-library.ts`, `apps/api/src/services/library.ts`, `apps/api/src/routes/library.routes.ts` (the sharing model + list/grant APIs).
- `apps/web/src/routes/creators/$creatorId/manage/` (ContextShell manage conventions).

## Notes
- The list API currently does cursor pagination only (no search/filter/sort) — the MVP filters operate client-side on loaded pages (fine for a small image library); server-side filtering/sorting comes with the unified vision. Don't lock UI controls whose semantics can't be implemented (the review's point) — ship only the supported subset above.
- Splits the old `content-library-ui` (superseded) into this + `content-media-picker`.
