---
id: brand-token-architecture-leak-cleanup
kind: story
stage: implementing
tags: [design-system]
parent: brand-token-architecture
depends_on: [brand-token-architecture-route-scoping-contract]
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-14
---

# Token foundation — eliminate ad-hoc color leaks

## Brief

Map all 96 audited literals (per `brand-token-architecture` → `## Design — Mapping table` +
`.memory/scratchpad/color-categorization.md`) to their target roles; eliminate non-exempt raw
leaks; retire `--color-secondary` (split its 3 jobs: selection → state tokens, calendar →
internal `--color-data-N`, decorative → accent/neutral); centralize badge/status contrast (no
universal `--color-on-status`/`-on-badge` — semantic ink on `-bg` tints, solids for non-text
dots only). Preserve the public-chart hold (emissions/revenue wait on org).

## Acceptance

- Zero non-exempt raw color literals outside token files (static no-leak check passes).
- `--color-secondary` retired; all consumers migrated to semantic roles.
- Badge/status contrast approach implemented; WCAG AA verified.
- Public charts (emissions/revenue) on a clear hold, not force-migrated.
