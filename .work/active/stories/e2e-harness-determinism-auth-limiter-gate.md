---
id: e2e-harness-determinism-auth-limiter-gate
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

# E2E harness: auth limiter gate for test profile

## Scope

Prevent the strict auth rate limiter from self-throttling the e2e suite under retries or shared CI IPs,
while keeping production strict. This absorbs the backlog concern `e2e-suite-self-rate-limits-auth`.

## Units

- `apps/api/src/config.ts` — add explicit e2e/test-profile configuration for auth limiter behavior
  rather than inferring from arbitrary env.
- `apps/api/src/app.ts` / `apps/api/src/middleware/rate-limit.ts` — relax or disable the strict
  sign-in limiter only when the e2e/test profile is active; production remains `max: 10`.
- `apps/e2e/playwright.config.ts` / `global.setup.ts` — set the e2e profile in CI webServer env and
  make auth setup resilient enough to report 429s clearly.
- API unit/integration test — proves strict limiter remains strict by default and relaxes only under
  the test profile.

## Acceptance criteria

- [ ] E2E auth setup can create all storage states under normal retry cadence without hitting 429.
- [ ] Production/default runtime keeps the strict sign-in limiter.
- [ ] The test-profile switch is explicit and covered by tests.
- [ ] `e2e-suite-self-rate-limits-auth` is removed from backlog or marked absorbed when this story lands.

## Test integrity contract

Do not globally weaken auth protection to make tests pass. If the limiter exposes a real auth bug, park
it. Test assertions must prove both relaxed e2e behavior and unchanged production defaults.
