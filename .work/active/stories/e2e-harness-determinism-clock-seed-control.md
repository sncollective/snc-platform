---
id: e2e-harness-determinism-clock-seed-control
kind: story
stage: done
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

- [x] E2E fixture IDs and timestamps are deterministic and collision-safe under parallel workers.
- [x] Browser-visible date/time assertions can opt into a fixed clock.
- [x] The convention is documented in the helper module and referenced by the feature body.
- [x] No production code path is forced to use test clocks or seeded RNG.

## Test integrity contract

If deterministic controls reveal a product bug, park it. Fix flaky test assumptions as test debt. Do
not loosen assertions to hide timing issues.

## Implementation notes

- Files changed:
  - `apps/e2e/tests/helpers/determinism.ts`
  - `apps/e2e/README.md`
  - `apps/e2e/global.setup.ts`
  - `apps/e2e/package.json`
- Tests added: no runtime spec added; added `@snc/e2e` `typecheck` script so helper contracts are machine-verified by TypeScript.
- Discrepancies from design: did not install a global browser clock in `global.setup.ts` because Playwright clock control is page/context-scoped and should remain opt-in per spec; documented `installFixedClock(page)` as the convention instead.
- Adjacent issues parked: none.

## Verification results

- `bun run --filter @snc/e2e typecheck` — pass.

## Review (2026-06-28)

**Verdict**: Approve

**Blockers**: none
**Important**: none
**Nits**: none

**Notes**: Fast-lane story review. The helper provides deterministic suffixes/IDs/timestamps and an opt-in Playwright fixed-clock helper without forcing production code onto test clocks. E2E typecheck passed.
