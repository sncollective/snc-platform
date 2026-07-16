---
id: web-use-polling-test-union-literal
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

# use-polling test fixture has a too-narrow union literal

## Brief

`apps/web/tests/unit/hooks/use-polling.test.ts` line 91 fails typecheck with
`error TS2322: Type '"b"' is not assignable to type '"a"'`. The test calls
`rerender({ channelId: "b" })` against a type that TypeScript inferred as the
literal `"a"` (from an earlier fixture line), so passing `"b"` is a type error.

**Why.** A test fixture (likely a `const` assertion or a function param) was inferred
too narrowly — the `channelId` should accept any string (or a known set of channel
ids), but TS narrowed it to the single literal `"a"` from context. This is a stale or
under-typed fixture, not a product bug.

**Surfaced triaging Forgejo run 97** (typecheck job, task 468).

## Design

Open `apps/web/tests/unit/hooks/use-polling.test.ts` around line 88–93 and fix the
narrow type inference. Likely options:

1. **Annotate the fixture/param explicitly** — give `channelId` a `string` type (or
   a proper union of test channel ids) so `"a"` and `"b"` are both assignable.
2. **Widen a `const` assertion** — if a `as const` is forcing the literal, remove it
   from the `channelId` field or cast appropriately.
3. **Use a typed factory** — if the test renders the hook via a helper, ensure the
   helper's props type is `{ channelId: string }`, not inferred from the first call.

Read the actual fixture before picking — the fix depends on which line narrowed it.

## Verification

- `bun run --filter @snc/web test` passes (the test runs, not just typechecks).
- `bun run typecheck` clears the `TS2322` for this file.

## Simplification opportunity

None — single test-fixture fix.

<!-- Implementation notes accumulate here when this story is picked up. -->
