---
id: e2e-determinism-test-vitest-import
kind: story
stage: drafting
tags: [testing, developer-experience]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-07-16
updated: 2026-07-16
---

# e2e determinism test imports vitest without a declared dep

## Brief

`apps/e2e/tests/helpers/determinism.test.ts` line 1 imports `{ describe, expect, it }`
from `"vitest"`, but `vitest` is not in `apps/e2e/package.json`. The typecheck job in
`platform-test-and-build.yml` fails with `error TS2307: Cannot find module 'vitest' or
its corresponding type declarations` for this file.

**Why.** The e2e package runs Playwright, not Vitest — its tests use Playwright's
`test`/`expect`. This helper file appears to have been written (or copied) using Vitest
APIs. Either it's a unit test that landed in the wrong package, or it's a helper that
shouldn't be importing a test runner at all.

**Surfaced triaging Forgejo run 97** (typecheck job, task 468).

## Design

Investigate `apps/e2e/tests/helpers/determinism.test.ts` and resolve the mismatch:

1. **If it's a real e2e helper** that should run under Playwright — rewrite the
   `describe`/`it`/`expect` imports to Playwright equivalents (`test.describe`,
   `test`, `expect`), or convert to a plain helper module with no test-runner import.
2. **If it's a unit test that landed in e2e by mistake** — move it to `apps/api` or
   `apps/web` (whichever owns the determinism logic it exercises) where Vitest is the
   runner, and adjust imports.
3. **If `vitest` should genuinely be an e2e devDep** (e.g. shared test utilities
   imported by Playwright specs) — add `vitest` to `apps/e2e/package.json` devDeps.

Pick the resolution that matches the file's actual role after reading it. Don't add
`vitest` as a dep just to silence the error if the file shouldn't be using it.

## Verification

- `bun run --filter '*' typecheck` passes (the `Cannot find module 'vitest'` error
  clears for this file).
- `bun run --filter @snc/e2e test` still passes — if the file moved, the e2e suite
  still covers whatever it was checking.

## Simplification opportunity

None identified until the file's role is confirmed.

<!-- Implementation notes accumulate here when this story is picked up. -->
