---
id: press-creator-one-sheet-fit-overflow
kind: story
stage: done
tags: [press]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-02
updated: 2026-09-02
---

# Creator one-sheet fit check rejects real-content volumes

`GET /api/creators/:id/press/one-sheet.pdf` 500s with "Press one-sheet does
not fit one page: vertical content overflow" against the real Animal Future
press config (4 members, 3 highlights, tagline, 2 releases — the seeded
`seed-press.ts` content, no images). Both `orientation=auto` and
`orientation=horizontal` fail. Found while generating the cycle-2 press PDFs
via the local endpoints (2026-09-02): `one-pager.pdf` and the per-release
`one-sheet.pdf` render fine; only the creator one-sheet hard-fails.

The one-page guarantee is the right invariant, but a 500 on plausible real
content is a dead end for the surface most likely to carry it. Options to
weigh at scoping: graceful density scaling (type/leading compression tiers
before failure), trimming strategy (drop lowest-priority sections at render
time with a visible indicator), or a 422 with a field-level overflow report
the editor can act on.

Release one-sheet unaffected (renders sparse-but-clean at current volume).

## Implementation notes
- Decision: density ladder (normal → compact → tight) inside `renderCreatorOneSheetPdf`, each tier compressing spacing vars/line-heights/figure sizes/hero height within readability floors; terminal exhaustion surfaces as `BrowserPdfSinglePageFitError` which the route maps to a 400 `VALIDATION_ERROR` with actionable guidance (shorten bio / reduce members/highlights). Rejected render-time section trimming — silently dropping personnel/credits from a press PDF is editorially dangerous; rejected keeping the 500 — plausible content volumes must not dead-end the surface.
- Mechanics: `oneSheetHtml` takes `density` (article gains `density-compact`/`density-tight`); tier CSS overrides the sheet's own spacing custom properties (`--s3/--s4/--s6`) plus targeted figure/hero/line-height/deck/title compressions; both orientations covered. `assertSinglePageFit` now throws a dedicated `BrowserPdfSinglePageFitError extends BrowserPdfPreflightError` so the ladder retries fit failures only — asset/preflight failures still fail fast.
- Files changed:
  - `apps/api/src/services/browser-pdf.ts` — `BrowserPdfSinglePageFitError` class; fit check throws it.
  - `apps/api/src/services/press-pdf.ts` — density param on `oneSheetHtml`, tier CSS in `oneSheetCss`, ladder loop in `renderCreatorOneSheetPdf` (rethrows last fit error after `tight`).
  - `apps/api/src/routes/press.routes.ts` — creator one-sheet route catches the fit error → `ValidationError` 400.
  - Tests: unit ladder mechanics (tier retry with compact class, exhaustion after 3 attempts ending at tight, non-fit errors propagate without retries — browser-pdf mock now exports a hoisted fit-error class), route 400 mapping (dynamic import for the class — the route factory resets the module registry, so a static import breaks instanceof), integration real-volume regression (AF-shaped heavy content renders single-page in both orientations, the exact content class that previously 500'd).
- Verification: full @snc/api unit suite green (66 in touched files); integration library.test.ts 11/11; live dev-stack render of the real Animal Future content (the reported failure case): auto + vertical both 200, single letter page each, all 4 members/3 highlights present; vision-subagent visual pass — compact tier confirmed engaged (hero ≈208px @100dpi), readable, consistent rhythm, no clipping. Ellipsized bio/description copy flagged by the reviewer is the layouts' pre-existing `truncateAtWord` editorial truncation, unchanged by this work.
- Discrepancies from design: none — item offered density scaling / trimming / 422-report; chose scaling + 400 terminal (platform's existing ValidationError vocabulary over a bespoke 422).
- Adjacent issues parked: none.

## Review record (2026-09-02, bounded inline pass — standalone story)
- Ladder retries only the fit error class; preflight/timeout/browser failures fail fast (unit-proven).
- Tier floors keep body ≥14px line-height / figures ≥40px — no unreadable compression; single-page guarantee preserved (fit check still enforced at every tier).
- Route mapping returns the platform-standard structured error body; 400 not 422 documented above.
- Live acceptance on the exact failing content is the strongest evidence; regression test pins it.
- Verdict: pass. stage: review → done.
