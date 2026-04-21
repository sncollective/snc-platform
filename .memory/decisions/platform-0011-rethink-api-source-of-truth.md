---
id: platform-0011
title: API source of truth — generated client vs hand-written (neutral, status quo retained)
status: active
created: 2026-04-20
updated: 2026-04-20
supersedes: []
superseded_by: null
revisit_if:
  - "A second API consumer is added (mobile app, external integration, CLI) — manual sync becomes prohibitive at multiple consumers"
  - "Manual type sync produces more than 3 drift-caused bugs in a rolling quarter"
---

## Context

The platform API is defined in three layers that must be kept in sync manually: the Hono route handlers in `apps/api/src/routes/`, the Zod schemas and inferred TypeScript types in `@snc/shared`, and the fetch wrapper functions in `apps/web/src/lib/`. Changing a single endpoint requires touching all three.

Scale at the time of analysis (2026-03-24): ~105 endpoints across 22 route files. The shared package holds ~1,603 LOC, of which ~1,000 LOC (~62%) are Zod schemas and inferred types that mirror API routes and are therefore derivable from the OpenAPI spec. The web client lib holds ~690 LOC of pure fetch wrappers (~45% of that layer) that are also mechanically derivable. In total, approximately 1,690 LOC across two layers is manual synchronization of what could be generated.

The platform already generates an OpenAPI 3.1 spec via `hono-openapi` v1.2.0 — all routes carry `describeRoute()` + `resolver()` annotations, and the spec is served at `/api/openapi.json` in non-production environments with Scalar UI at `/api/docs`.

The analysis was conducted under the elimination + inversion lenses on 2026-03-24.

## Alternatives considered

### OpenAPI codegen (`openapi-typescript` / `openapi-fetch` / `@hey-api/openapi-ts`)

**How it works.** A build-time tool reads the OpenAPI 3.1 spec (snapshot file or dev server URL) and generates a typed TypeScript client. The spec already exists and is verified.

**What changes.** API layer: nothing. Shared package: remove ~1,000 LOC of derivable schemas and types; keep error classes, `StorageProvider`, `Result`, domain constants, feature flags, UI metadata (~600 LOC remaining). Web layer: replace ~690 LOC of hand-written fetch wrappers with generated client imports. Build: add a codegen step (`openapi-ts` or equivalent).

**Trade analysis.**
- Incremental migration — one domain at a time (smallest: `booking.ts` at ~22 LOC, one function).
- Language-agnostic: a future mobile app or CLI can use the same spec.
- Type fidelity is lossy across the JSON Schema round-trip — Zod refinements (`.refine()`), transforms (`.transform()`), branded types don't survive. However, the web app only imports structural types from shared (`z.infer<>` object shapes, string unions, nullable fields) — not Zod-specific features. The round-trip handles these cleanly.
- Introduces a spec-staleness failure mode: if a `describeRoute` annotation is missing or wrong, the generated client will be wrong with no immediate compile-time signal. An agent reading the generated client cannot verify freshness without checking the spec separately.
- Requires a build step: spec snapshot → codegen → commit, or CI staleness check.
- Risk assessment from analysis: low. The spec is already tested for 3.1 compliance; migration is incremental.

### Hono RPC (`hc` client — inline type inference)

**How it works.** Hono's built-in `hc()` function infers types directly from `typeof app` at compile time. No intermediate spec — TypeScript types flow server to client.

**Blockers in the current codebase (identified 2026-03-24).**
1. Feature-gated route registration: routes are mounted conditionally inside `if (features.content)` blocks. The `typeof app` type is determined by the static code path and omits feature-gated routes. Would require always registering routes and gating at middleware level instead — an architectural change.
2. Separate `Hono()` instances per file: the current `app.route()` pattern doesn't capture the chained return type. Would require restructuring to a chained `.route().route()...` pattern with a single exported `AppType`.
3. Dynamic federation routes: loaded via `import()` (line 121-123 in `app.ts`). Dynamic imports cannot contribute to the static type chain.
4. Multiple route files on the same prefix (content + content-media both at `/api/content`; creator + creator-member both at `/api/creators`).

**Trade analysis.**
- Perfect type fidelity — no lossy translation; Zod types flow directly from handler to client.
- No build step, no spec generation; compile errors propagate immediately across the client boundary.
- Requires restructuring route registration, feature gating, and the dynamic import pattern — touches the core app setup and all 22 route files. Medium-high risk.
- TypeScript-only — no benefit for non-TS consumers (mobile, CLI, external integrations).
- Tight coupling between API and web at the type level — monorepo-only pattern.
- If Hono RPC is pursued later, Approach C (route factory — see route unification decision) would interfere with type inference.

### Hand-written (status quo)

Keep the three-layer manual sync: API handler → shared schema → web fetch wrapper.

**Trade analysis.**
- Fully explicit: every API call in the web layer is a visible function with typed parameters that an agent reading code cold can follow end-to-end without understanding a code generation pipeline.
- No build step, no spec freshness dependency, no generated artifacts to diff.
- Linear maintenance cost: each endpoint change is a three-file edit. Acceptable with one consumer; grows painful at two or more.
- Agent readability benefit: the three-file dance is mechanical, but each file's intent is explicit. Generated clients introduce an indirection layer where an agent must understand what was generated and from what state of the spec.

## Decision

**Neutral — status quo retained for now.** The hand-written three-layer pattern is kept without change.

The analysis concluded that OpenAPI codegen (Approach A / hybrid Approach C) would eliminate ~1,690 LOC of mechanical duplication and is the natural next step if a second consumer is added. Hono RPC delivers stronger guarantees but requires non-trivial route restructuring before it's viable. For the current single-consumer setup (one web app), the manual sync cost is bounded and the explicitness benefit — particularly for agent workflows where code cold-reads are common — is real. The silent staleness risk introduced by codegen (generated client diverges from the live API without a compile-time signal) is a meaningful concern in an agent-heavy workflow.

Net: neutral for the current setup. Neither codegen approach is rejected; both are deferred until the consumer count or bug-rate conditions in `revisit_if` trip.

## Revisit if

- A second API consumer is added (mobile app, external integration, CLI). At two consumers, manual sync becomes prohibitive — the per-endpoint cost is doubled and the consumer-specific type duplication multiplies. Codegen is the right move at that point.
- Manual type sync produces more than 3 drift-caused bugs in a rolling quarter. Count drift incidents (type mismatch between API and web causing a runtime error or test failure). If the rate exceeds 3 in a quarter, the maintenance cost has exceeded the explicitness benefit.

If route unification lands (see platform-0012) and produces a cleaner, more consistent `describeRoute` annotation surface, revisit Hono RPC viability — the feature-gating and chaining blockers may be resolved by that work.

## Consequences

**Retained from status quo:**
- Full code explicitness — every API call in the web layer is a visible, typed function readable without understanding a codegen pipeline.
- No build-step dependency; no spec-staleness failure mode.
- Agent cold-reads follow a predictable three-file pattern: route file → shared schema → web lib file.

**Deferred:**
- ~1,690 LOC of derivable code remains hand-maintained. Acceptable at single-consumer scale; becomes the primary argument for revisit at two consumers.
- OpenAPI codegen migration path (Approach A/C) is fully documented and can be executed incrementally when conditions warrant.
- Hono RPC remains viable after route registration is restructured — not foreclosed by this decision.

**Shared package shape (unchanged):** `@snc/shared` continues to carry ~1,603 LOC including the ~1,000 LOC of derivable schemas. The residual non-derivable content (~600 LOC: error classes, `StorageProvider`, `Result`, domain constants, feature flags, UI metadata) would remain under either codegen approach and is the stable core of the package.
