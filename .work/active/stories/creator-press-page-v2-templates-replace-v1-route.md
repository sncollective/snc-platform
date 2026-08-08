---
id: creator-press-page-v2-templates-replace-v1-route
kind: story
stage: done
tags: [creators, content, ui]
parent: creator-press-page-v2-templates
depends_on: [creator-press-page-v2-templates-render-a, creator-press-page-v2-templates-render-b]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-07
---

# Press templates — selector and v1 route replacement

## Checkpoint

Finish the public surface in place at
`apps/web/src/routes/creators/$creatorId/press.tsx`:

- exhaustive `Record<"A" | "B", ComponentType<PressTemplateProps>>` selector;
- no query override and no dual v1/v2 render;
- preserve loader/404/canonical/PDF contracts and update OG/Twitter image priority
  to delivered banner → about → first gallery;
- safely break the page out of global `.main-content` for the full-width hero
  while preserving centered 980px content;
- replace obsolete v1 CSS/photo-index/standout/release markup, leaving the manage
  editor untouched;
- verify assembled screen and letter-print behavior, including app-shell chrome.

## Acceptance evidence

Integrated route tests cover A/B dispatch, 404/error behavior, PDF URL, v2 OG
image selection, sparse images, and exact `press@s-nc.org` mailto. Web typecheck,
focused tests, desktop/mobile screenshots, and print preview pass. Source grep
finds no new `press@snc.org`, legacy `/press/photos/:index`, or individual
`@tanstack/start-*` resolution.

## Ordering

Final integration checkpoint after both explicit template renders are complete.

## Implementation notes
- Execution capability: direct inline ownership; route replacement and exhaustive selector formed one integration boundary.
- Review weight: standard (project default; feature stops at review per operator transition instruction).
- Files changed: `apps/web/src/components/press/press-page.tsx`/CSS, `apps/web/src/routes/creators/$creatorId/press.tsx`/CSS, `apps/web/tests/unit/components/press/press-page.test.tsx`, and the public press route test.
- Tests added/removed: selector A/B tests plus route coverage for delivered rendering, exact contact/PDF links, 404/error propagation, Template B dispatch, and banner→about→gallery metadata priority; obsolete indexed-photo assertions were replaced, not weakened.
- Simplification: deleted the v1 photo-index, standout-track, release-list, and duplicated section markup in place; no dual renderer or query override remains.
- Discrepancies from design: none.
- Visual verification: a green production build was served with the real Animal Future API payload (all v2 image slots empty) and visually inspected at 1440×3500 and 390×3500. The assembled app-shell route broke the gradient hero to the viewport edges while retaining the centered wordmark/editorial/footer, displayed all five locked streaming icons, kept fixed PDF action clear of mobile tab chrome, and showed no broken images or horizontal overflow. Isolated populated A/B and Firefox letter-print findings are recorded on the render stories.
- Exact-string verification: `press@s-nc.org`/`mailto:press@s-nc.org` passed; no `press@snc.org`, public `/press/photos/`, individual `@tanstack/start-*` resolution, or legacy public markup remained.
- Verification: web suite 182 files / 1,864 tests passed; web typecheck 0 errors; web production build passed; API suite 124 files / 1,978 tests passed; API TypeScript check 0 errors.
- Adjacent issues parked: none.
