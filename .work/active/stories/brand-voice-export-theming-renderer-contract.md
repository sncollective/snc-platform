---
id: brand-voice-export-theming-renderer-contract
kind: story
stage: done
tags: [design-system]
parent: brand-voice-export-theming
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-14
---

# Brand voice export theming — renderer contract

## Checkpoint

Make every public press PDF consume an explicit producing-unit voice under a fixed light-paper
mode. Extend the Playwright adapter so server-generated one-sheet bodies can retain the live
web page's compiled token/font head; use that for creator and release sheets, and keep full
Template A/B printing on the same browser path.

## Design element

- Add validated `documentAttributes` and URL-only `replaceBodyHtml` preparation to
  `apps/api/src/services/browser-pdf.ts`; preparation occurs before export style injection,
  asset readiness, print emulation, fit preflight, and `page.pdf`.
- Add `PdfExportIdentity`/`resolvePdfExportIdentity` in
  `apps/api/src/services/press-pdf.ts`. Known producing units resolve their matching voice;
  null/unknown resolves Records. Creator decoration requires both a federation handle and a
  curated brand color.
- Set `data-theme="light"` and `data-export-voice` for every render. Inject a later PDF-root
  scope that maps accent/hover/bg/subtle/on-accent/accent2 directly to child 1's
  `--voice-<name>-*` variables and maps voice font/radius sources without consulting
  `data-route`.
- Keep text on the voice's contrast-verified accent/on-accent pair. Use eligible creator color
  only through print-local `--export-accent-decoration` on non-text rules/borders.
- Replace the still-active release `@react-pdf/renderer` document with compact escaped HTML/CSS
  printed through the same browser adapter. Preserve its route and one-page Letter contract,
  then remove the dependency and obsolete API-only font/color embedding.
- Remove `PdfTheme`/`PDF_THEMES` and theme inputs from the route/service contract. Every press
  route passes `producingUnit: "records"`, `profile.handle`, and `profile.brandColor`
  explicitly; orientation and QR URL remain unchanged.

## Ordering constraint

This checkpoint consumes the finalized `brand-token-architecture` voice families, font sources,
and light spine. Do not copy placeholder values while that dependency is unfinished.

## Acceptance evidence

- [x] Browser adapter tests prove retained-head body replacement and document attributes are
  applied before readiness/print, reject invalid option combinations, and preserve deadline,
  cleanup, concurrency, asset, and one-page-fit behavior.
- [x] Resolver/service tests cover Records, Studio, and unknown→Records plus the four creator
  eligibility combinations (handle/color, handle-only, color-only, neither).
- [x] Full Template A/B, horizontal/vertical creator one-sheet, and release one-sheet styles
  reference child 1's light voice variables without a copied voice literal registry.
- [x] A conflicting route voice cannot override the explicit PDF-root voice scope.
- [x] Real Chromium integration produces Letter output with compiled tokens/fonts and real
  media after body replacement; creator/release sheets remain exactly one page.
- [x] `@react-pdf/renderer`, old API font embeds, fixed accent/secondary constants, and theme
  query types have no remaining source/manifest references.
- [x] API unit, integration, and typecheck commands pass.

## Implementation notes

- Execution capability: `gpt-5.6-sol`; selected by the autopilot caller for the retained-head renderer, CSS-cascade, and cross-package browser-integration risk.
- Review weight: `standard` from the caller; feature review is intentionally deferred to the orchestrator.
- Files changed: `apps/api/src/services/browser-pdf.ts`, `apps/api/src/services/press-pdf.ts`, `apps/api/src/routes/press.routes.ts`, `apps/api/package.json`, `bun.lock`, `apps/web/src/components/press/press-sections.module.css`, and API unit/integration tests.
- Tests added/removed: added preparation-order and validation coverage, export resolver/eligibility matrices, explicit selector precedence assertions, retained-body HTML contracts, long release fields, and a real A/B + horizontal/vertical/release Chromium Letter fixture; removed obsolete theme-query assertions while preserving QR, asset, fit, deadline, cleanup, and concurrency coverage.
- Simplification: all press PDFs now use one Playwright adapter; removed React-PDF, its transitive dependency tree, API-only Inter/Source Serif embeds, copied palette branches, and caller-selected PDF themes.
- Discrepancies from design: none. The existing 1×1 integration PNG was upgraded to a generated 96×96 PNG because imgproxy returned an undecodable result to Chromium at that size; the fixture still exercises real Garage and imgproxy paths.
- Adjacent issues parked: none. The recorded press-route SSR `fetch failed` risk did not reproduce; full Template A/B retained-head renders completed against the live local web/API services.
