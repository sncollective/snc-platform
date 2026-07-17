---
id: e2e-determinism-test-vitest-import
kind: story
stage: done
tags: [testing, developer-experience]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-07-16
updated: 2026-07-17
resolved_at: 2026-07-17
resolved_by: "21358fc"
---

# e2e determinism test imports vitest without a declared dep

## Brief

`apps/e2e/tests/helpers/determinism.test.ts` line 1 imports `{ describe, expect, it }`
from `"vitest"`, but the e2e package runs Playwright (not Vitest) and has no vitest
runner configured. Two distinct failures surfaced from this mismatch:

1. **Typecheck** — `error TS2307: Cannot find module 'vitest'` (the original symptom,
   surfaced triaging Forgejo run 97, typecheck task 468).
2. **Runtime** — once vitest was added as a devDep to clear #1, Playwright began
   *loading* the file and crashed the whole e2e suite with
   `TypeError: Cannot read properties of undefined (reading 'config')` at the
   `describe("seededSuffix", ...)` call (surfaced triaging Forgejo run 104, e2e task
   508). The crash aborted the run before any `.spec.ts` executed.

**Why.** The file is a vitest-style unit test of pure helper functions
(`seededSuffix`, `testSeededSuffix`, `stableTestId`, `fixedFixtureDate`) that live in
`apps/e2e/tests/helpers/determinism.ts` (consumed by e2e specs like
`creator-programming.spec.ts`). It is not a Playwright browser spec and has no business
running under the e2e runner. The e2e package has no vitest config and no vitest script.

## Design

The file's role (confirmed by reading it + the helper): **a vitest unit test of an
e2e-local pure helper**. It should not run under Playwright, and there is no vitest
runner in e2e to run it under. Two resolution paths were considered:

- **(Original, wrong) Add `vitest` as an e2e devDep.** Clears the typecheck (TS2307)
  but makes Playwright try to load the file at runtime → crashes the suite. Rejected.
- **(Adopted) Exclude `tests/helpers/*.test.ts` from Playwright discovery** via
  `testIgnore` in `playwright.config.ts`, and keep no vitest dep. The test remains
  typechecked by `tsc` as a contract (it still must resolve its imports and typecheck),
  but Playwright never loads it. This matches the file's actual role: a static contract
  on the helper's surface, not an executable browser test.

Rejected alternative not retried: moving the test to `@snc/api`/`@snc/web` (where
vitest runs) would require cross-workspace imports of an e2e-local helper, which is
awkward and not worth it for a contract test.

## Verification

- `bun run --filter @snc/e2e typecheck` exits 0 — the test file still typechecks as a
  contract (tsc resolves the vitest types via the hoisted `node_modules`; the file's
  imports are valid).
- `playwright test --list` no longer includes `determinism.test.ts` — it's correctly
  excluded from e2e discovery, so it won't crash the suite.
- The actual e2e `.spec.ts` suite is unblocked to run (run 104's crash aborted before
  any spec executed; this fix removes that abort).

## Simplification opportunity

None — additive `testIgnore` entry, no existing behavior changed. The `vitest` devDep
that the original (wrong) fix added to `apps/e2e/package.json` was removed in the same
commit (`21358fc`).

## Implementation notes

- 2026-07-16: original fix added `vitest@^4.0.18` to e2e devDeps to clear the
  typecheck TS2307. This was the wrong resolution — it cleared the type error but
  introduced the runtime crash (run 104). Caught when e2e first ran green-enough to
  reach the Playwright load step (after test-shared was unblocked).
- 2026-07-17: corrected to `testIgnore` + devDep removal (commit `21358fc`). Both
  failures (typecheck + runtime) now resolved with no vitest runner needed in e2e.
