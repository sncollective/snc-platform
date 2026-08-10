---
id: creator-press-page-v2-pdf
kind: feature
stage: done
tags: [creators, content, ui]
parent: creator-press-page-v2
depends_on: [creator-press-page-v2-content-model, creator-press-page-v2-templates, creator-profile-brand-color]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-09
---

# Press page v2 — PDF (render template to letter)

## Brief
The one-pager PDF becomes the **chosen template rendered to letter-size** (one
content source, not a separate @react-pdf document). The locked templates already
carry `@page letter` print CSS; this feature implements the save-to-PDF path so
the "Download one-pager (PDF)" action produces a faithful letter-size render of
the selected template (A or B), with the burn-in photo credits.

## Epic context
- Parent epic: `creator-press-page-v2`
- Position: consumer of the content model + templates; reuses the template
  rendering for the PDF output.

## Simplification opportunity
- Replaces the v1's standalone `press-pdf.ts` (@react-pdf one-pager) — which
  duplicated the layout in @react-pdf's dialect — with a single template render
  that serves both the web page and the PDF. (Feature-design decides the
  mechanism: headless print of the template vs. continuing @react-pdf with the
  template's layout; the goal is one source of truth.)

## Foundation references
- v1 PDF: `apps/api/src/services/press-pdf.ts`, `apps/api/src/routes/press.routes.ts` (.pdf endpoints)
- `.mockups/design-system/tokens.css`; the `@page letter` CSS in `final-{1,3}.html`

## Mockups
- **Full PDF (clean, web-matching):** the locked templates at print size —
  the `@page letter` + `@media print` rules in `final-1.html` / `final-3.html`
  (already shipped by the `creator-press-page-v2-templates` feature). This is the
  **MVP default** for this round.
- **Press 1-sheet (clean) — LOCKED (operator sign-off 2026-08-09):** two parallel,
  distinctly-designed single-page one-sheets (pick by lead-photo orientation) at
  `.mockups/screens/creator-press-page-v2-pdf-onesheet/`:
  - `option-1.html` — horizontal-lead one-sheet.
  - `option-2.html` — vertical-lead one-sheet (calmer/condensed: 1-para bio,
    members = photos + names + roles (no bios), 2 horizontal highlights).
  Built against `.claude/skills/print-design/SKILL.md` (grid/baseline/type floors);
  QR links a customizable URL (default = creator's linktree). Round-1 alternatives
  in `…/round-1/`.
- **Zine/edgy direction — PARKED (stretch goal):** `.mockups/screens/creator-press-page-v2-pdf/zine-stretch/`
  — a punkier PDF template, deferred to a later pass (the web templates stay the
  safe default; a punkier web template is also a future stretch goal).

## Design decisions (operator, 2026-08-08/09)
- **This round's MVP = the clean, web-matching PDF** (full + 1-sheet). The zine
  direction is held for another pass.
- **Two outputs:** a full press PDF (multi-page, the template's print output) AND
  a distinctly-designed **1-sheet** (curated single page — not a truncated full).
- **Color scheme** is a creator-pickable option on the clean template:
  Editorial Light / Dark (web-matching default) / **Creator Brand Accent**.
- **Brand color lives on the creator profile** (`creatorProfiles.brandColor`, a
  curated-palette field) so it's reusable site-wide; the Creator Brand Accent PDF
  scheme + future surfaces read it. The editor delivers the setter; the PDF consumes it.
- **QR destination** = a customizable URL (default = creator's linktree/link-in-bio,
  not bandcamp).
- **Per-release one-sheet** (e.g. AF's next single) is a near-term reuse of this
  print template system — the v1 already had `renderOneSheetPdf`; the v2 picks it
  up on the same grid/aesthetic. Not this feature's scope, but the template/
skill generalize to it.
- Mechanism (headless print of the template vs. continuing @react-pdf) is a
  feature-design decision; goal remains one source of truth for the render.

## Implementation notes
- Execution capability: direct inline owner; the PDF render/service/route surface was cohesive and the caller prohibited nested agents.
- Review weight: standard (project default), with the caller-requested stop boundary at `stage: review`.
- Render mechanism: Playwright Chromium prints the live public press route for the full PDF, so the selected A/B React template and its existing `@media print` CSS remain the single source of truth. The same browser adapter prints the locked orientation-specific one-sheet HTML at exact Letter geometry; QR SVG generation uses ECC M and a four-module quiet zone.
- Files changed: `apps/api/src/services/browser-pdf.ts`, `apps/api/src/services/press-pdf.ts`, `apps/api/src/lib/{imgproxy,press-url}.ts`, `apps/api/src/routes/press.routes.ts`, API health/shutdown wiring, API package/lock dependencies, PDF route/service/integration tests, and the live template print CSS (`press.module.css` plus the press template/section/image/carousel/streaming modules).
- Routes: the existing `/press/one-pager.pdf` now prints the complete live template; `/press/one-sheet.pdf` adds the curated single-page output. Both accept `theme=light|dark|brand`; the one-sheet also accepts `orientation=auto|horizontal|vertical` and an HTTP(S) `url` QR override. Creator Brand Accent consumes `creatorProfiles.brandColor` with the standard accent fallback.
- Tests added/updated: route contract coverage for themes/orientation/custom QR validation; service coverage for full-template printing, both one-sheet compositions, brand/light colors, photo-credit burn-in, AF Linktree fallback, storage authorization, QR footprint, and one-page output. The library integration now proves real Garage legacy/library media embed in the browser-rendered one-sheet.
- Test integrity: repaired two stale pre-existing integration fixtures discovered by the mandatory full run: explicit `undefined` was being lost through a default parameter in test-control gating, and channel-lifecycle fixtures no longer created creator/key/session parents required by current foreign keys.
- Simplification: removed the duplicated creator @react-pdf layout and image-read path from `renderOnePagerPdf`; @react-pdf remains only for the existing release-specific route, which is outside this feature's replacement scope.
- Discrepancies from design: PDF theme and QR choices are validated route inputs because the completed shared content model exposes no PDF preference fields and the caller explicitly forbade editor/shared-schema/migration writes. The PDF surface is ready for the owning editor feature to persist and emit those query choices without another renderer change. The local dev web process currently returns an unrelated SSR `fetch failed`; full-render visual proof therefore used the locked full-template HTML through the production browser adapter, while the adapter now rejects non-2xx render targets instead of producing an error-overlay PDF.
- Visual verification: after the blocker fixes, rendered horizontal and vertical Animal Future one-sheets in light/dark/brand, rasterized all six, and inspected them page-by-page against the locked compositions. All six are 612 × 792pt Letter and exactly one page; the live-dates link now occupies its reserved content slot, vertical deck/bio are distinct, metric emphasis is visible, safe areas and the intentional pre-footer buffer hold, and the dynamically sized vector QR remains crisp with a readable fallback URL. `pdffonts` reports embedded Inter Regular/Bold and Source Serif 4 Regular/Bold (the redistributable embedded Georgia-role face), with no Liberation fallback. The live full-PDF endpoint was attempted again and remains blocked before printing by the separately-owned web SSR `fetch failed`; see Deploy follow-up.
- Verification: API unit suite **125 files / 2,001 tests passed**; API integration suite **11 files / 51 tests passed** (including real Garage → crop-aware imgproxy → Chromium PDF proof); API and web typechecks **0 errors**.
- Adjacent issues parked: none.

## Review-blocker remediation
- Chromium is a restartable singleton with two concurrent page slots, a 30-second hard request deadline (including the font/image `page.evaluate()` wait), per-page cleanup, failed-asset/non-2xx/DOM-fit preflight failures, graceful shutdown, and `/health/pdf` readiness. Public creator PDF routes share a six-per-minute/IP limiter.
- The one-sheets render `liveDatesUrl` in the locked live-dates slot for MVP. Selected date records remain owned by the parked Bandsintown integration epic; they were not fabricated without a data source.
- Vertical layout uses `shortBio` only as its deck and the first `longBio` paragraph as its distinct bio (falling back only when no long bio exists).
- Live template print CSS now uses a 0.5in safe area, declared 12-column/12px-gutter and 4px baseline tokens, 7.5pt prose and 6.5pt metadata floors, baseline spacing, intrinsic page flow instead of trapped fixed-height whitespace, and forced white hero tagline contrast in light output.
- One-sheet images now use persisted crops through print-dimension `buildPressImageUrl` outputs (2250 × 750 horizontal hero; 725 × 3000 vertical rail; 300ppi-sized member/cover assets). Source originals are dimension-checked after persisted and aspect fill crops; insufficient resolution emits a structured warning.
- Single-page output now runs a DOM geometry/overflow fit preflight before printing. QR footprint derives from encoded module count at ≥0.4mm/module, starts at 0.8in, and rejects payloads that would exceed the 128px layout allowance.
- Deterministic PDF fonts are embedded from runtime dependencies: Inter for UI/prose and Source Serif 4 for the Georgia editorial role. Browser-adapter tests cover missing executable, hard timeout, non-2xx page, failed asset, DOM overflow, cleanup after print errors, and the two-page concurrency cap.

## Deploy follow-up
- **Chromium provisioning:** pin the Playwright Chromium executable/version and install its OS dependencies in the devcontainer and production bootstrap. The e2e-only browser installer is not the production renderer provisioning contract. `/health/pdf` is the readiness probe once provisioning lands.
- **Live full-PDF proof:** resolve the unrelated press-route SSR `fetch failed`, then rerun the full template PDF in light/dark/brand and inspect every page. This is not attributed to commit `2c32004` and does not replace the successful one-sheet/browser-adapter verification above.
- **Bandsintown:** selected live-date records arrive with the parked Bandsintown epic; until then the MVP deliberately prints `liveDatesUrl`.
