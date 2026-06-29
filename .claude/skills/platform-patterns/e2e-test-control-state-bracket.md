# e2e-test-control-state-bracket

Bracket mutable E2E tests with deterministic test-control seed/reset calls.

## When to use
Use for browser tests that need real backend state but must avoid cross-test contamination.

## Instances
- `apps/e2e/tests/creator-programming.spec.ts:140` — `beforeEach` seeds Maya programming state through test-control.
- `apps/e2e/tests/creator-programming.spec.ts:150` — `afterEach` resets the same fixture.
- `apps/e2e/tests/creator-channel-playback.spec.ts:18` — playback proof resets channel/engine state after mutation.
- `apps/e2e/tests/creator-channel-browser-playback.spec.ts:83` — browser proof seeds pool/queue/channel/engine preconditions.

## Canonical sketch
```ts
test.beforeEach(async ({ request }, testInfo) => {
  await seedDomainState(request, deterministicFixture(testInfo));
});
test.afterEach(async ({ request }, testInfo) => {
  await resetDomainState(request, deterministicFixture(testInfo));
});
```

## Anti-patterns
Don't mutate shared demo state without reset; don't use test-control as an assertion shortcut for product behavior.
