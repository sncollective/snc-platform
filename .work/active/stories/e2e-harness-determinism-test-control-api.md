---
id: e2e-harness-determinism-test-control-api
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

- [ ] Test-control routes are unreachable in normal production-like runtime unless the explicit
      e2e/test-control flag is set.
- [ ] Reset/seed creates fixture rows with stable prefixes and cleans them before and after use.
- [ ] The helper can reset Maya creator-programming state without driving UI controls.
- [ ] At least one API/integration test proves the test-control surface is gated off by default.

## Test integrity contract

If this story exposes a real production bug, park it instead of silently bundling the fix. Repair
bad fixtures/assertions in-session. Never weaken an assertion just to make the suite green.
