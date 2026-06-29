---
id: e2e-harness-determinism-clock-seed-control
kind: story
stage: implementing
tags: [testing, developer-experience, e2e-test]
parent: e2e-harness-determinism
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-28
updated: 2026-06-28
---

# E2E harness: clock and seed control

## Scope

Provide deterministic time and randomness controls for e2e setup so specs that touch dates, ordering,
tokens, or seeded fixture names do not depend on wall-clock timing or ambient RNG.

## Units

- `apps/e2e/tests/helpers/determinism.ts` — shared helpers for stable test IDs, seeded suffixes, and
  a documented fixed clock value.
- `apps/e2e/global.setup.ts` / Playwright project setup — install the fixed-clock convention where
  browser-visible time matters, using Playwright clock APIs where available and explicit fixture values
  otherwise.
- API-side test-control helpers — accept explicit timestamps/IDs instead of generating ambient values
  for e2e fixtures.

## Acceptance criteria

- [ ] E2E fixture IDs and timestamps are deterministic and collision-safe under parallel workers.
- [ ] Browser-visible date/time assertions can opt into a fixed clock.
- [ ] The convention is documented in the helper module and referenced by the feature body.
- [ ] No production code path is forced to use test clocks or seeded RNG.

## Test integrity contract

If deterministic controls reveal a product bug, park it. Fix flaky test assumptions as test debt. Do
not loosen assertions to hide timing issues.
