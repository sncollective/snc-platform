---
id: gate-tests-determinism-helper-behavior
kind: story
stage: drafting
tags: [testing]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: tests
created: 2026-06-29
updated: 2026-06-29
---

# Determinism helper behavior has only typecheck coverage

## Priority
Medium

## Spec reference
Item: `e2e-harness-determinism-clock-seed-control`
Acceptance criterion: "E2E fixture IDs and timestamps are deterministic and collision-safe under parallel workers."

## Gap type
missing test for valid partition / boundary

## Suggested test
```ts
it("stableTestId is deterministic, bounded, and separates parallel worker/project seeds", () => {
  const a = stableTestId(fakeTestInfo("chromium", "case A"), "pool-row", { prefix: "creator-programming" });
  const b = stableTestId(fakeTestInfo("mobile", "case A"), "pool-row", { prefix: "creator-programming" });

  expect(a).toBe(stableTestId(fakeTestInfo("chromium", "case A"), "pool-row", { prefix: "creator-programming" }));
  expect(a).not.toBe(b);
  expect(a.length).toBeLessThanOrEqual(80);
});
```

## Test location (suggested)
`apps/e2e/tests/helpers/determinism.test.ts`
