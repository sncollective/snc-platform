---
id: content-library-page
kind: feature
stage: review
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

## Implementation notes
- Execution capability: direct inline implementation; one route-level owner was the safest fit for the cohesive UI, state, responsive CSS, and tests, with no nested subagents per caller instruction.
- Review weight: standard (project default); implementation stops at `stage: review` as explicitly requested by the autopilot caller.
- Files changed: `apps/web/src/routes/creators/$creatorId/manage/library.tsx`, `library.module.css`, the parent manage nav route, route tests, and creator test fixtures repaired for the concurrently landed required `brandColor` contract.
- Tests added/removed: added `apps/web/tests/unit/routes/creators/manage/library.test.tsx` (five behavior tests covering source/sharing filters, active chips and reset, sort, grid/table semantics, keyboard Escape focus restoration, loading/empty/no-results, and pagination); extended the manage-shell nav test; no tests removed.
- Simplification: kept filtering/sorting entirely client-side over cursor-loaded pages, used native radios/checkboxes/select and a semantic table/list instead of adding a filter framework, and omitted every deferred rich-library control.
- Discrepancies from design: the locked mock's deferred type/tags/properties/owner/search/edit controls were intentionally omitted per the confirmed MVP brief; upload CTAs hand off to the existing press image-field workflow rather than duplicating the concurrently owned media picker.
- Adjacent issues parked: none.

## Verification
- `bun run --filter @snc/web test` — 185 files / 1891 tests passed.
- `bun run --filter @snc/web typecheck` — passed (route tree generated, zero TypeScript errors).
- `cd apps/web && npx tsc --noEmit` — passed with zero output.
- Firefox headless visual verification used a fresh profile per screenshot and the real route component inside the real `ContextShell`: 1440px grid, 1024px table, 390px grid, and 1440px empty state. The hierarchy and compact library framing match the locked option; source/sharing/sort controls, active chip/count row, read-only sharing/use badges, semantic table columns, one-column mobile grid, and centered upload-led empty state are present. No document-level horizontal overflow, clipped cards, off-edge controls, duplicate content, or mobile title overlap was visible; the mobile top padding was corrected during the pass.
- Exact-string grep over the route found no email, domain, URL, or deferred-control strings requiring literal verification.
