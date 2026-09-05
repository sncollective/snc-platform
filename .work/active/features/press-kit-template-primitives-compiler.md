---
id: press-kit-template-primitives-compiler
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

# Design-primitives token compiler MVP

## Brief

Lift the existing CSS token architecture (`apps/web/src/styles/tokens/**`)
from hand-maintained CSS declarations to data, and compile that one source
to every target surface: CSS custom properties (byte-compatible output —
existing consumers unchanged, the color-leaks test stays green), Typst
definitions, and IDML swatches/styles on export. This is the shared source
language all three surfaces (CSS/Chromium, Typst, IDML) consume — the
seed named in the operator architecture decision. Scope deliberately
excludes layout composition: templates keep identity, primitives keep the
language shared. Generated style-grammar cards and variant capacity
numbers in primitive units are later extensions owned downstream.

## Epic context

- Parent epic: `press-kit-template-integration`
- Position in epic: foundation feature — the Typst track and IDML
  interchange both depend on its compiler outputs; nothing else may be
  blocked on it.

## Simplification opportunity

- Replaces hand-synced token duplication across surfaces ("lift CSS
  declarations to data, compile everywhere, never hand-sync").
- Deliberately retains the CSS consumption pattern (custom properties) —
  zero migration for existing consumers is a contract, not an accident.

## Foundation references

- `docs/typesetting-toolchain-landscape.md` — "Design primitives as the
  shared language" section (operator decision, 2026-09-03)
- `apps/web/src/styles/tokens/index.css` — the seed tree to lift
