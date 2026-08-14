---
id: brand-token-architecture-theming
kind: story
stage: implementing
tags: [design-system]
parent: brand-token-architecture
depends_on: [brand-token-architecture-token-restructure]
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-14
---

# Token foundation — theming (light/dark/system) + mode toggle

## Brief

Implement the mode mechanism (per `brand-token-architecture` →
`## Design — Theming & route mechanism`): `data-theme-preference` (persisted) + `data-theme`
(effective) attributes on `<html>`, a pre-hydration head bootstrap that resolves system
preference and sets both attributes before paint, `storage`-event cross-tab sync, and
`color-scheme` set to the effective mode. Replace the dark-only meta at `__root.tsx:44` and
reorder against the self-hosted font stylesheet to prevent flash. Build the **mode-toggle
settings control** (light/dark/system) writing the same persistence contract.

## Acceptance

- Effective light/dark attributes + system resolution + first-paint bootstrap (no flash).
- Mode-toggle settings control (light/dark/system) persists preference; cross-tab sync.
- Both-mode contrast test harness in place.
- No voice-accent work yet (that's `voice-accents`).
