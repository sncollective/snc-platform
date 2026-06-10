---
status: held-neutral
authored: 2026-06-10
provenance: agent-synthesis
revisit_if:
  - A second API consumer is added (mobile app, external integration, CLI) — manual sync becomes prohibitive at multiple consumers; codegen is the right move at that point
  - Manual type sync produces more than 3 drift-caused bugs in a rolling quarter — count drift incidents (type mismatch between API and web causing a runtime error or test failure)
---

# Position: API source of truth — hand-written three-layer pattern (neutral, status quo)

**Status: held-neutral.** The analysis was conducted; neither codegen approach was recommended
for the current setup. Status quo retained until the consumer count or bug-rate conditions trip.

## The stance

**The hand-written three-layer pattern is kept: API handler → `@snc/shared` schema →
`apps/web/src/lib/` fetch wrapper.** Both OpenAPI codegen and Hono RPC are documented and
available for adoption when conditions warrant; neither is rejected outright.

### Context

The platform generates an OpenAPI 3.1 spec via `hono-openapi` v1.2.0 — all routes carry
`describeRoute()` + `resolver()` annotations, served at `/api/openapi.json`. At the time of
analysis (2026-03-24): ~105 endpoints across 22 route files; `@snc/shared` holds ~1,603 LOC of
which ~1,000 LOC (~62%) are Zod schemas and inferred types derivable from the OpenAPI spec; the
web client lib holds ~690 LOC of pure fetch wrappers also mechanically derivable. In total,
approximately 1,690 LOC across two layers is manual synchronization of what could be generated.

### Why status quo is the current answer

For the current single-consumer setup (one web app), the manual sync cost is bounded and the
explicitness benefit is real: every API call in the web layer is a visible, typed function
readable without understanding a code generation pipeline. For an agent-heavy workflow where
codebase cold-reads are frequent, the explicit dispatch flow (every step visible on every
endpoint) is more readable than helper abstractions obscure. The silent staleness risk
introduced by codegen (generated client diverges from the live API without a compile-time
signal) is a meaningful concern.

## Deferred options

### OpenAPI codegen (`openapi-typescript` / `openapi-fetch` / `@hey-api/openapi-ts`)

Would eliminate ~1,690 LOC of mechanical duplication. Spec is already verified and tested for
3.1 compliance. Migration is incremental — one domain at a time. Risk is low.

**Not adopted because:** Introduces a spec-staleness failure mode with no immediate compile-time
signal. Incremental migration is available but not warranted at single-consumer scale.
The round-trip is lossy for Zod refinements (`.refine()`, `.transform()`, branded types) — not
a problem for the web app (imports structural types only), but a constraint to acknowledge.

If route unification lands (see `positions/route-handler-ceremony.md`) and produces a cleaner
`describeRoute` annotation surface, revisit Hono RPC viability — the feature-gating and
chaining blockers may be resolved by that work.

### Hono RPC (`hc` client — inline type inference)

No intermediate spec; TypeScript types flow server to client. Perfect type fidelity, no
lossy translation, no build step.

**Not adopted because:** Four structural blockers identified in the codebase as of 2026-03-24:
(1) Feature-gated route registration: routes mounted inside `if (features.content)` blocks —
the `typeof app` type is determined by the static code path and omits feature-gated routes.
Would require always registering routes and gating at middleware level instead — an
architectural change. (2) Separate `Hono()` instances per file: the current `app.route()`
pattern doesn't capture the chained return type. (3) Dynamic federation routes loaded via
`import()`. (4) Multiple route files on the same prefix. Restructuring route registration,
feature gating, and the dynamic import pattern touches the core app setup and all 22 route
files — medium-high risk.

Hono RPC remains viable after route registration is restructured. If the route-unification
work proceeds (per `positions/route-handler-ceremony.md` conditions), re-evaluate at that
point.

## Consequences (retained from status quo)

- Full code explicitness: every API call in the web layer is a visible, typed function readable
  without understanding a codegen pipeline.
- No build-step dependency; no spec-staleness failure mode.
- Agent cold-reads follow a predictable three-file pattern: route file → shared schema → web
  lib file.
- ~1,690 LOC of derivable code remains hand-maintained. Acceptable at single-consumer scale;
  becomes the primary argument for revisit at two consumers.
