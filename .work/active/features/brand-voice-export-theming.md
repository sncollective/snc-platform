---
id: brand-voice-export-theming
kind: feature
stage: drafting
tags: [design-system]
parent: brand-voice-system
depends_on: [brand-token-architecture]
release_binding: null
gate_origin: null
created: 2026-08-13
updated: 2026-08-13
---

# Brand voice — export / print theming

## Brief

Wire the voice token model into the existing press-PDF export path so PDFs render in a
voice theme. Export already ships (the `creator-press-page-v2-pdf` feature, done):
`apps/api/src/services/browser-pdf.ts` renders templates A/B to letter-size via Playwright
(HTML→PDF); the public press page offers "Download full press PDF" + "Download one-sheet
PDF"; PDFs already consume the creator brand color; the manage UI has pdfDark/pdfAccent
preview variants. So this is a **theming-wiring task on existing infrastructure**, not a
new pipeline.

## Scope

- Apply voice tokens to the print stylesheet (templates A/B already carry `@page letter`
  print CSS; tokens resolve there).
- Decide voice selection for export: does a press PDF render in the Records voice (press
  content), the creator's brand color (current behavior), or a creator-chosen voice? (Open
  question for design.)
- Confirm print-mode constraints: print is a fixed-palette medium (typically no dark mode);
  verify voice tokens render correctly in the print context.

## Simplification opportunity

- Cruft: the legacy v1 `press-pdf.ts` (`@react-pdf/renderer`) was replaced by the Playwright
  path in v2 — confirm it's dead and remove.

## Depends on

`brand-token-architecture` — voice tokens must exist. Does NOT require the route-scoping or
toggle mechanisms (export voice selection is explicit, not route-derived).

<!-- Design accumulates via feature-design once the foundation lands. -->
