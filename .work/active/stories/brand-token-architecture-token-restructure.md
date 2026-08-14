---
id: brand-token-architecture-token-restructure
kind: story
stage: implementing
tags: [design-system]
parent: brand-token-architecture
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-14
---

# Token foundation — restructure to reference model

## Brief

Create the new token composition/file shape (per `brand-token-architecture` →
`## Design — Token file structure`): `tokens/index.css` + semantic color files
(`color/{spine,status,state,media,badges,data}`) + `voices/{families,resolution}` +
`fonts.css` / `typography.css` / `radius.css` / etc. Seed the complete shared light/dark role
set from org's placeholder values, using the per-file mode-block contract
(`:root,[data-theme="light"]` / `[data-theme="dark"]` / `@media prefers-color-scheme` no-script
fallback).

## Acceptance

- New file structure exists; `global.css` imports only `tokens/index.css`.
- Every shared role (neutral ramp, status, state, media, badges, internal data) defined in
  both modes with placeholder values from the reference.
- NO consumer changes yet — existing tokens/aliases still resolve (additive only; consumers
  migrate in `alias-migration`).
- Literal values live only inside role files; `voices/resolution.css` is literal-free.
