---
id: press-kit-template-registry
kind: feature
stage: drafting
tags: [press, templates, media-pipeline]
parent: press-kit-template-integration
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-04
updated: 2026-09-04
---

# Declarative template registry

## Brief

Introduce a declarative template registry and port the four existing PDF
products (band one-sheet vertical/horizontal, release one-sheet, release
EPK companion) from their current hand-wired pinning in
`press-pdf.ts`/`press.routes.ts` to registry entries. Each entry carries
what the pinned templates already encode implicitly: identity (name,
theme support, orientation/content modes), per-slot geometry (the source
of truth for per-slot image specs), and its measured capacity contract.
This consolidates registration and gives the picker and programmatic
siblings one declarative surface to consume. External package ingestion
(Typst/IDML sources) is NOT in scope — that is the artifact-contract
feature's gate.

## Epic context

- Parent epic: `press-kit-template-integration`
- Position in epic: parallel foundation alongside the primitives compiler
  (no dependency between them); the artifact contract converges on it.

## Simplification opportunity

- Consolidates hand-wired template registration in route/service code
  into declarative entries — the epic's primary delete/consolidate arc.
- The capacity contract carried per entry replaces the empirically-held
  tier knowledge from the campaign session with published data.

## Coordination (sibling features, no depends_on by design)

- `press-kit-template-picker-and-image-specs` consumes per-slot geometry
  from registry entries (spec sheets computed from slot geometry, not
  hand-written docs).
- `press-kit-programmatic-surface` render manifest should treat the
  registry entry as ground truth for template metadata.

## Foundation references

- `.memory/sessions/press-kit-retrospective-2026-09-03.md` — §7 template
  architecture direction; templates as products, adjustments as content
  fields
- `apps/api/src/services/press-pdf.ts`, `apps/api/src/routes/press.routes.ts`
  — the hand-wired surface being consolidated
