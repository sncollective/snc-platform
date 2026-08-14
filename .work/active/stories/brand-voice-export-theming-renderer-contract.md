---
id: brand-voice-export-theming-renderer-contract
kind: story
stage: implementing
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

- [ ] Browser adapter tests prove retained-head body replacement and document attributes are
  applied before readiness/print, reject invalid option combinations, and preserve deadline,
  cleanup, concurrency, asset, and one-page-fit behavior.
- [ ] Resolver/service tests cover Records, Studio, and unknown→Records plus the four creator
  eligibility combinations (handle/color, handle-only, color-only, neither).
- [ ] Full Template A/B, horizontal/vertical creator one-sheet, and release one-sheet styles
  reference child 1's light voice variables without a copied voice literal registry.
- [ ] A conflicting route voice cannot override the explicit PDF-root voice scope.
- [ ] Real Chromium integration produces Letter output with compiled tokens/fonts and real
  media after body replacement; creator/release sheets remain exactly one page.
- [ ] `@react-pdf/renderer`, old API font embeds, fixed accent/secondary constants, and theme
  query types have no remaining source/manifest references.
- [ ] API unit, integration, and typecheck commands pass.
