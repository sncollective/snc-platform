---
id: press-dark-export-theme
kind: story
stage: done
tags: [press, design-system]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-02
updated: 2026-09-02
---

# Dark-theme press PDF exports

Operator taste call (campaign relay): press PDFs should support the dark
Records voice (cast60 `#171929` bg, `#FF6B5E` accent) alongside the current
forced light paper export. `exportDocumentAttributes` hardcodes
`data-theme: "light"` (brand-voice-export-theming); the token architecture
already carries full dark sheets (`spine.css` semantic tokens,
`families.css` dark voice accents) — the export just pins light.

## Strategic decisions
- **Interface: explicit `?theme=dark` query param, default light** — explicit beats automatic for artifact generation; campaign re-renders on demand; light stays available for print-preferred outlets; zero surprise for existing renders.
- **QR stays on its light patch** — QR modules + quiet zone are the payload-critical fixed pair (comment in press-pdf.ts: "not themeable UI"); scan reliability on dark sheets comes from the white patch, kept deliberate.
- **Priority order** (per campaign): vertical one-sheet → horizontal one-sheet → one-pagers.

## Acceptance
- `?theme=dark` on the three press PDF endpoints produces dark-voiced PDFs; default remains light (byte-stable back-compat for existing artifacts).
- Dark renders pass visual check: cast60 bg, #FF6B5E accent, readable text contrast, image filters acceptable on dark, QR patch scannable-looking.
- Unit + route tests cover theme threading and invalid-theme rejection; export-CSS boundary checker stays green (no new raw pigments).

## Implementation notes
- The token architecture carried almost everything: semantic tokens (`spine.css`) and voice accents (`families.css`) are already theme-scoped by `data-theme` — the export merely pinned light. Implementation is the unpinning plus threading.
- Files changed:
  - `apps/api/src/services/press-pdf.ts` — `PDF_EXPORT_THEMES` const + `PdfExportIdentity.theme?` (default light); `exportDocumentAttributes` and the `exportVoiceScope` selector key off the resolved theme; QR pair untouched by design (payload-critical fixed colors, per the existing boundary-test allowlist).
  - `apps/api/src/routes/press.routes.ts` — `theme` query param (`light|dark`, default light) on all three press PDF endpoints (one-sheet extends `PressOneSheetQuerySchema`; one-pager + release routes gain `PressPdfThemeQuerySchema`); threaded into each `exportIdentity`.
  - Tests: unit (dark threads into documentAttributes + voice scope selector; default stays light), routes (dark reaches the renderer identity, default light pinned, invalid theme 400; existing call-shape assertions updated for the explicit `theme: "light"` default — legitimate drift), route-factory press-pdf mock exports `PDF_EXPORT_THEMES`.
- No image-filter re-tuning needed: the locked layouts' filters are overlay-relative and read as deliberate on dark per the visual pass.
- Verification: full @snc/api unit suite green; export-CSS boundary checker 9/9 (no new raw pigments); live renders of all four dark artifacts (vertical one-sheet 2.0MB, horizontal 2.4MB, release 350KB, one-pager 2.9MB — the one-pager exercises the web-page dark path, distinct from the locked layouts); two vision-subagent passes: dark one-sheet (cast60 bg confirmed by pixel sample, #FF6B5E accent, no #B5302A remnants, text contrast readable, QR patch crisp with proper quiet zone, "deliberate fade" rail judgment) and dark one-pager (no half-migrated light blocks, dark-themed square tags — the earlier radius fix flowing through, member/highlight cards intact). Default-light path re-verified live (200).
- Discrepancies from design: none — campaign's suggested shape (identity param + route threading) adopted as proposed; interface settled as `?theme=dark`.
- Adjacent: campaign's in-flight seed-press.ts content edit (Connor crop round 2) left unstaged — their lane.

## Review record (2026-09-02, bounded inline pass — standalone story)
- Back-compat: default light preserved at every layer (schema default, identity default, live re-verify); existing artifacts render unchanged.
- Boundary discipline: no new raw pigments; QR pair untouched (scan reliability on dark comes from the white patch, judged deliberate by the visual pass).
- Both dark code paths covered: locked layouts (one-sheets) and live web page (one-pager).
- Verdict: pass. stage: implementing → done.
