---
id: research-handoff-stack-library-gap-audit-3
tags: [refactor]
release_binding: null
research_origin: stack-library-gap-audit
created: 2026-06-18
---

# [refactor] Remove vestigial `as never` casts in API route handlers

Our route files carry ~122 `c.req.valid("param" as never) as T` (and `"query"`/`"json"`) casts.
The gap audit's adversarial-verification pass established these are **vestigial, not required**:
stripping every cast from `apps/api/src/routes/content-media.routes.ts` and `playout.routes.ts`
and running `tsc --noEmit` on `@snc/api` passed clean (exit 0); seven route files already use
`valid()` with no cast at all. The inline `hono-openapi` `validator()` propagates the validated
`Input` type into the handler via Hono's method-chain overload — the bare `new Hono<AuthEnv>()`
instance (no `S` generic) does **not** force `c.req.valid()` to `unknown`, contrary to what the
`route-handler-ceremony` position previously assumed.

## Scope / shape
- Pure structural cleanup, behavior-preserving (passes the black-box test → `[refactor]`): remove
  the `as never` + the trailing `as { ... }` assertion at each `c.req.valid(...)` site, letting the
  inferred type stand. Verify with `tsc --noEmit` per file as you go.
- ~122 sites across the `*.routes.ts` files. Mechanical but touches many files — likely a
  `/agile-workflow:refactor-design` pass that spawns per-file or per-cluster stories.
- **Update the `route-handler-ceremony` position** while here: it currently names the
  `c.req.valid('query' as never) as T` cast as "a known hono-openapi limitation … explicit and
  auditable." That premise is now disproven — the cast is removable cruft, not a limitation. The
  position should be corrected (the ceremony's other steps still stand; only the cast claim falls).

Low priority — no runtime effect, taste/cleanliness only. Confirmed via source + `tsc`, so it's a
real cleanup, not a hunch.

## Research grounding

**Source**: `.research/analysis/briefs/stack-library-gap-audit-landscape.md` (slug: `stack-library-gap-audit`); attestation `.research/attestation/hono-src-4-12-8.md`.

Adversarially verified against Hono v4.12.12 + our routes (casts stripped, tsc passed): the `as never` casts are redundant. Cleanup opportunity + a correction to the route-handler-ceremony position's premise.
