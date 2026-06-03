---
tags: [emissions]
release_binding: null
created: 2026-04-20
---

# Emissions Calculation Engine

Implement the server-side calculation service at `apps/api/src/services/emissions-calc.ts`.

Methods to implement:

- `token-type-estimate` — per-token-type Wh factors multiplied by grid intensity
- `studio-hour-estimate` — equipment profiles times active/inactive hours
- `vinyl-lca-adjusted` — VRMA baseline plus facility-specific reductions
- `epa-freight-factor` — weight times distance times EPA factor

Emission factor constants sourced from `config.ts` env or a constants file. Unit tests required for each method with known inputs and expected outputs.
