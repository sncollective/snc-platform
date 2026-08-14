---
id: brand-token-architecture-alias-migration
kind: story
stage: implementing
tags: [design-system]
parent: brand-token-architecture
depends_on: [brand-token-architecture-leak-cleanup, brand-token-architecture-font-loading]
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-14
---

# Token foundation — migrate consumers + retire aliases

## Brief

Migrate all color/font/radius consumers to the new token vocabulary (per
`brand-token-architecture` → `## Design — Spine-vs-voice conventions` + mapping table);
delete the backwards-compat alias tokens (`--color-primary`, `--color-muted`,
`--color-text-on-accent`, `--color-bg-alt`, the `--color-warning` alias, etc. — the
reference's naming is the target); collapse old `color.css` into the new composition. Promote
the conventions draft into `platform-patterns.md` + the AGENTS.md CSS section. Run the static
no-leak check and a full visual/contrast matrix across both modes.

## Acceptance

- All consumers use the new vocabulary; no backwards-compat aliases remain.
- Old `color.css` / shadow aliases removed; `global.css` imports only `tokens/index.css`.
- Conventions promoted into `platform-patterns.md` + AGENTS.md CSS section.
- Static no-leak check + visual/contrast matrix pass in both modes.
