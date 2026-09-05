---
id: press-kit-template-idml-interchange
kind: feature
stage: drafting
tags: [press, templates, media-pipeline]
parent: press-kit-template-integration
depends_on: [press-kit-template-primitives-compiler]
release_binding: null
gate_origin: null
created: 2026-09-04
updated: 2026-09-04
---

# IDML interchange + Scribus bridge

## Brief

Spike-first feature building the professional interchange lane: parse real
IDML files (zip + XML: designmap, Spreads, Stories, Resources) to capture
design intent — geometry, styles, swatches — and write machine-generated
IDML from primitives-compiler outputs (swatches/styles) plus template
geometry. The design-authority regime applies: when pro designers join,
their IDML artifact becomes design source of truth and pipelines conform
via render-fidelity checks (extract-and-compare, luminance checks at
fixed test content). The Scribus disposition rides here: generated IDML
must open correctly in Scribus 1.6.6 (stable track) — the one-way bridge
criterion — and the ≥1.6.4 PDF/X-4 finisher workflow is documented as the
physical-print outlet. Static fonts only in generated IDML (Scribus does
not implement variable fonts — verified systematic limitation).

## Epic context

- Parent epic: `press-kit-template-integration`
- Position in epic: evidence track gated on the primitives compiler; the
  artifact contract depends on its format findings. No SLA format target —
  Scribus reached via IDML import + Scripter only.

## Simplification opportunity

- Deliberately excludes any SLA parse/generate machinery (declined with
  evidence — see foundation reference) and any InDesign-licensing surface.

## Spike criteria (first implementation units)

- Real-file parse: extract page geometry, styles, swatches from sample
  IDML
- Round-trip write: machine-generated minimal IDML with primitives
  swatches opens in Scribus 1.6.6 (operator-verifiable criterion);
  optionally re-checked on 1.7.3

## Foundation references

- `docs/scribus-bridge-and-finisher.md` — verified version matrix, bridge
  + finisher lanes, declined-SLA evidence
- `docs/typesetting-toolchain-landscape.md` — IDML section +
  design-authority regime (operator, 2026-09-03)
