# stable-e2e-fixture-family-ids

Generate readable, bounded, deterministic fixture IDs from Playwright test identity + worker/project seed parts.

## When to use
E2E tests mutate shared backend/demo state. Random IDs make failures hard to reproduce; fixed IDs collide under parallel workers. Need deterministic cleanup targets that partition by project/test/worker.

## Instances
- `apps/e2e/tests/helpers/determinism.ts:49,64,75,89` — canonical seed parts, suffix, test-scoped suffix, bounded stable ID.
- `apps/e2e/tests/creator-programming.spec.ts:28,34,141,151` — derives stable fixture family from testInfo.
- `apps/api/src/services/test-control.ts:49-58,60,242,324` — server maps fixture IDs to row IDs, scopes cleanup.
- `apps/e2e/tests/helpers/determinism.test.ts:24,40,58` — helper behavior covered.

## Anti-patterns
Don't use Date.now()/Math.random() for e2e fixture identity; don't use one fixed ID across parallel workers; don't clean broad demo state when a deterministic family can be targeted.
