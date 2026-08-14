---
id: brand-token-architecture-route-scoping-contract
kind: story
stage: implementing
tags: [design-system]
parent: brand-token-architecture
depends_on: [brand-token-architecture-voice-accents]
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-14
---

# Token foundation — route-scoping CSS contract

## Brief

Add the `[data-route]` alias-resolution blocks (per `brand-token-architecture` →
`## Design — Theming & route mechanism` → "Route voice resolution"):
`[data-route="studio|tv|records"]` blocks that re-point the generic aliases
(`--color-accent`, `--radius`, `--font-body`, etc.) at the matching voice family. **CSS
contract + tests only** — sibling feature `brand-voice-route-scoping` (epic child 2) wires the
real leaf-container `data-route` attributes at runtime.

## Acceptance

- Route alias blocks exist for studio / tv / records; Parent is the no-attribute default.
- Route contract tests/fixtures verify each route resolves the correct voice.
- No runtime plumbing (that's epic child 2).
