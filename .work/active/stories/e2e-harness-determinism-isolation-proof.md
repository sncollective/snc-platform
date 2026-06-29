---
id: e2e-harness-determinism-isolation-proof
kind: story
stage: done
tags: [testing, developer-experience, e2e-test]
parent: e2e-harness-determinism
depends_on: [e2e-harness-determinism-test-control-api]
release_binding: null
gate_origin: null
created: 2026-06-28
updated: 2026-06-28
---

# E2E harness: parallel-safe isolation proof

## Scope

Convert the creator-programming pool-mutating e2e cases from shared-demo-state UI reset to the new
test-control reset/seed helper. This is the proof case that the harness can remove serial/chromium-only
partitioning for mutation tests.

## Units

- `apps/e2e/tests/creator-programming.spec.ts` — remove `resetMayaProgramming()` UI surgery and the
  `test.describe.configure({ mode: "serial" })` / chromium-only skip for pool-mutating cases.
- `apps/e2e/tests/helpers/test-control.ts` — call reset/seed from `beforeEach` with per-worker or
  per-test fixture identity as needed.
- `apps/e2e/playwright.config.ts` — keep `fullyParallel: true`; no project-level special casing for
  these mutation cases after conversion.

## Acceptance criteria

- [x] Pool-mutating creator-programming specs run in both chromium and mobile projects when their UI
      assertions are viewport-valid.
- [x] The mutation cases no longer use UI removal loops as test setup.
- [x] No case depends on prior run state in the shared demo DB.
- [x] The converted spec remains black-box for product assertions; the test-control API is setup only.

## Test integrity contract

If the converted spec reveals product breakage, park the product bug and keep the test honest with a
linked skip/xfail only when necessary. Fix bad test assumptions in-session. No tautological green
assertions.

## Implementation notes

- Files changed:
  - `apps/e2e/tests/creator-programming.spec.ts`
  - `apps/e2e/tests/helpers/test-control.ts`
  - `apps/api/src/services/test-control.ts`
  - `apps/api/src/routes/test-control.routes.ts`
  - `apps/api/tests/integration/test-control-service.test.ts`
  - `apps/e2e/playwright.config.ts`
- Tests added: integration coverage for fixture-scoped test-control cleanup so parallel e2e cases do
  not delete each other's deterministic content/pool rows.
- Discrepancies from design: the existing test-control helper only targeted the shared Studio Tour
  seed row, which was not actually parallel-safe across chromium/mobile projects. I extended the
  test-control setup surface to accept deterministic per-test fixture IDs/titles, then used those
  fixtures from the creator-programming spec.
- Adjacent issues parked: none.

## Verification results

- `bun run --filter @snc/api typecheck` — passed.
- `bun run --filter @snc/api test:integration -- test-control-service.test.ts` — passed.
- `bun run --filter @snc/e2e typecheck` — passed.
- `bun --cwd apps/e2e playwright test tests/creator-programming.spec.ts --reporter=list --no-deps` —
  passed (12 tests across chromium and mobile). Local PM2 API was restarted with
  `TEST_CONTROL_PROFILE=e2e AUTH_RATE_LIMIT_PROFILE=e2e` for this verification because the default
  local staging API did not have the e2e-only test-control route mounted.

## Review (2026-06-28)

**Verdict**: Approve

**Blockers**: none
**Important**: none
**Nits**: none

**Notes**: Fast-lane story review. Implementation verification covers API typecheck, test-control integration, e2e typecheck, and the converted creator-programming spec across chromium and mobile. Product assertions remain browser-facing; test-control is setup-only.
