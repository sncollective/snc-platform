---
id: brand-token-architecture-voice-accents
kind: story
stage: implementing
tags: [design-system]
parent: brand-token-architecture
depends_on: [brand-token-architecture-theming]
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-14
---

# Token foundation — voice accent families

## Brief

Define the complete four-voice accent families (Parent / Studio / TV / Records) — accent,
hover, bg, subtle, on-accent, accent2, base radius — in both modes (per
`brand-token-architecture` → `## Design — Token file structure`, `voices/families.css`),
seeded from placeholder values. Set Parent generic defaults on `:root` (the resolution aliases
point at Parent until route blocks land in `route-scoping-contract`). Per-voice radius
variants (sm/md/lg/xl) declared explicitly next to each base.

## Acceptance

- All four voices complete in both modes (all 7 accent roles + radius variants).
- Parent is the `:root` default; `--color-accent` etc. resolve to Parent.
- Provisional link aliases (`--color-link: var(--color-accent)`) centralized in
  `voices/resolution.css` for one-edit revert.
- `accent-subtle` present for all four voices (org's oversight fix).
