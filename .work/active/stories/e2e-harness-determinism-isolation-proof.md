---
id: e2e-harness-determinism-isolation-proof
kind: story
stage: implementing
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

- [ ] Pool-mutating creator-programming specs run in both chromium and mobile projects when their UI
      assertions are viewport-valid.
- [ ] The mutation cases no longer use UI removal loops as test setup.
- [ ] No case depends on prior run state in the shared demo DB.
- [ ] The converted spec remains black-box for product assertions; the test-control API is setup only.

## Test integrity contract

If the converted spec reveals product breakage, park the product bug and keep the test honest with a
linked skip/xfail only when necessary. Fix bad test assumptions in-session. No tautological green
assertions.
