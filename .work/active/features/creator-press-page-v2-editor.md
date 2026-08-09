---
id: creator-press-page-v2-editor
kind: feature
stage: review
tags: [creators, content, ui]
parent: creator-press-page-v2
depends_on: [creator-press-page-v2-content-model, creator-press-page-v2-image-management, creator-profile-brand-color, press-config-draft-publish]
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

## Implementation notes
- Execution capability: direct inline owner; the editor state, validation, persistence, and visual composition form one cohesive feature, and the caller explicitly prohibited nested agents.
- Review weight: standard (project default), with the caller-requested stop boundary at `stage: review`.
- Files changed: `apps/web/src/routes/creators/$creatorId/manage/press.tsx`, `-press-editor.tsx`, `-press-editor-model.ts`, `manage-press.module.css`, and `apps/web/tests/unit/routes/creators/manage/press-manage.test.tsx`.
- Delivered: locked tabbed workbench; WAI-ARIA tab/tabpanel relationships and roving Arrow/Home/End focus; one cohesive typed `PressContent` draft; explicit Unsaved/Saving/Saved/Error/Publishing/Published feedback; save, publish, and discard endpoints; preview-draft versus view-live separation; global error summary with cross-tab focus; tab dirtiness/issue markers; publish gating; all v2 content fields; in-context member/highlight/gallery images; exact slot-ratio image preview overrides; curated site-wide brand setter; PDF theme preview selection; keyboard reorder; empty asset states; and 44px controls.
- Tests added/updated: eight route tests protect tab keyboard behavior, draft-only saves, cross-tab error focus and publish gating, save-before-publish ordering, brand/PDF integration, member reorder announcements, gallery remove→replace state, and recoverable save errors. The route tests retain the image-management regression's local key/derived `photos` proof rather than weakening it.
- Simplification: replaced the v1 editor's many disconnected state cells and release-specific form duplication with one normalized `PressContent` draft plus small UI-only state; draft cleanup and cross-tab validation are pure model functions.
- Discrepancies from design: the completed shared `PressContent` contract has no PDF-theme preference field, while the caller forbade shared-schema/migration writes. The production picker therefore controls the real PDF route's `theme=light|dark|brand` preview immediately, but does not claim that preference as part of the persisted press draft. All other editor content persists through the draft API. Visual proof used a temporary Vite harness mounting the real production `PressEditor` with endpoint-shaped intercepted responses because the standing local app route currently returns the already-documented unrelated SSR `fetch failed`; the harness was removed after capture.
- Adjacent issues parked: none.

## Verification
- `bun run --filter @snc/web test` — 185 files / 1,893 tests passed.
- `bun run --filter @snc/web typecheck` — passed with zero diagnostics.
- Firefox headless visual verification — 19 fresh browser contexts: every tab at 1440, 1024, and 390px, plus the failed-save/error-summary and global publish surface. Visually compared against locked option 2: dark ContextShell alignment, workbench hierarchy, responsive stacking, empty image slots, true gallery/slot proportions, and focus/error affordances match the design. Programmatic checks found exact document width at all three viewports, exactly one selected/tabbable tab, no horizontal page overflow, and no visible control below 44px.
- Exact-string check retained `press@s-nc.org` and the full `https://open.spotify.com` fixture; no `press@snc.org` typo was introduced.
- `git diff --check` — passed.
