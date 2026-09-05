---
id: press-kit-template-typst-track
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

# Typst-WASM compile track

## Brief

Spike-first feature validating the architecture bet on a second render
engine: verify typst-WASM (typst.ts is the candidate to verify) compiles
in-process under Bun with deterministic output, and that capacity-contract
measurement — the Typst-side equivalent of the CSS fit-check — is
expressible (overflow detection, content-volume boundaries). Then build
the minimal compile lane: a one-sheet-shaped `.typ` template authored from
primitives-compiler outputs (Typst definitions), compiled in-process,
feeding the registry as the first non-CSS template source. The two-engine
cost was accepted at architecture-decision time; this feature is where
that bet is paid or refuted with evidence.

## Epic context

- Parent epic: `press-kit-template-integration`
- Position in epic: evidence track gated on the primitives compiler; the
  artifact contract depends on its findings (package realities,
  measurability).

## Simplification opportunity

- None structural — this is the accepted-cost lane. Deliberately scoped
  minimal: one template shape, not a Typst port of all four products.

## Spike criteria (first implementation units)

- Deterministic compile: same source + primitives in, byte-stable PDF out
- Capacity measurability: over-budget content detected loudly with
  boundary mapping (bio chars, slot counts), matching the CSS track's
  400-with-guidance discipline

## Foundation references

- `docs/typesetting-toolchain-landscape.md` — Typst section +
  architecture decision (operator, 2026-09-03)
- `.memory/sessions/press-kit-retrospective-2026-09-03.md` — loud-failure
  over silent adaptation; deterministic print rules
