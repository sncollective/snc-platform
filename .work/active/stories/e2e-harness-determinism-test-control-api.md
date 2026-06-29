---
id: e2e-harness-determinism-test-control-api
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

# E2E harness: test-control reset/seed API

## Scope

Add a deterministic test-control surface for e2e reset/seed operations, gated so it cannot run in
production. This replaces UI-surgery reset patterns for shared demo-state mutations and makes each
mutation test start from a known clean slate.

## Units

- `apps/api/src/routes/test-control.routes.ts` — e2e-only Hono routes for reset/seed operations.
- `apps/api/src/services/test-control.ts` — reset/seed helpers using prefixed fixture IDs and
  FK-safe cleanup, following the integration-suite pattern from
  `apps/api/tests/integration/creator-playout/cross-tenant-isolation.test.ts`.
- `apps/api/src/app.ts` / `apps/api/src/config.ts` — mount only when an explicit e2e/test-control
  env flag is enabled and fail closed outside local/CI test profiles.
- `apps/e2e/tests/helpers/test-control.ts` — Playwright request helper for reset/seed.

## Acceptance criteria

- [x] Test-control routes are unreachable in normal production-like runtime unless the explicit
      e2e/test-control flag is set.
- [x] Reset/seed creates fixture rows with stable prefixes and cleans them before and after use.
- [x] The helper can reset Maya creator-programming state without driving UI controls.
- [x] At least one API/integration test proves the test-control surface is gated off by default.

## Test integrity contract

If this story exposes a real production bug, park it instead of silently bundling the fix. Repair
bad fixtures/assertions in-session. Never weaken an assertion just to make the suite green.

## Implementation notes

- Files changed:
  - `apps/api/src/config.ts`
  - `apps/api/src/app.ts`
  - `apps/api/src/routes/test-control.routes.ts`
  - `apps/api/src/services/test-control.ts`
  - `apps/api/src/services/playout-queue-transitions.ts`
  - `apps/api/tests/config.test.ts`
  - `apps/api/tests/helpers/test-constants.ts`
  - `apps/api/tests/integration/test-control-gating.test.ts`
  - `apps/api/tests/integration/test-control-service.test.ts`
  - `apps/e2e/tests/helpers/test-control.ts`
- Tests added:
  - `apps/api/tests/integration/test-control-gating.test.ts`
  - `apps/api/tests/integration/test-control-service.test.ts`
- Discrepancies from design: none; queue seeding routes through `enqueue()` so the existing
  `playout_queue.status` single-writer invariant remains intact while still accepting a stable
  e2e fixture id.
- Adjacent issues parked: none.

## Verification results

- PASS: `bun run --filter @snc/api build`
- PASS: `bun run --filter @snc/api typecheck`
- PASS: `bun x tsc --noEmit -p apps/e2e/tsconfig.json`
- PASS: `bun run --filter @snc/api test:unit`
- PASS: `bun run --filter @snc/api test:integration -- test-control-gating.test.ts`
- PASS after starting dev services and applying migrations: `bun run --filter @snc/api test:integration -- test-control-service.test.ts` (2 tests).
- Earlier blocked verification was resolved by starting the dev stack and running `bun run --filter @snc/api db:migrate`.

## Review (2026-06-28)

**Verdict**: Approve

**Blockers**: none
**Important**: none
**Nits**: none

**Notes**: Fast-lane story review after verification repair. The initial integration proof depended on demo rows already existing in the local DB; the test now seeds its own prerequisite Maya creator/channel/content rows with `onConflictDoNothing`, then verifies deterministic reset/seed behavior. Targeted integration now passes against migrated dev services.
