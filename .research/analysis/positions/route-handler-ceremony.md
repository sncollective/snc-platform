---
status: held-neutral
authored: 2026-06-10
provenance: agent-synthesis
revisit_if:
  - Human collaborators join the codebase and find the explicit 6-step ceremony noisy rather than readable — at that point Approach A or B is the natural starting point
  - A recurring bug pattern is traced to a forgotten ceremony step (e.g. missing validator() call, wrong auth middleware) — if ceremony omission causes bugs, a factory that enforces the ceremony becomes a correctness argument
  - A fast-iterating feature area identifies the boilerplate as a concrete velocity blocker (e.g. scaffolding 10 new endpoints in a sprint where ceremony becomes the bottleneck)
---

# Position: Route handler ceremony — explicit 6-step pattern (neutral, status quo)

**Status: held-neutral.** The analysis showed helper abstractions would reduce structural
repetition with low risk, but the current agent-heavy single-owner setup favors explicit
dispatch. Status quo retained until human-collaborator or bug-pattern conditions trip.

## The stance

**The explicit 6-step route handler pattern is kept without helper abstraction.** Every endpoint
follows: (1) `describeRoute()` OpenAPI metadata block, (2) `validator()` input schema, (3) auth
middleware, (4) `c.req.valid()` parse, (5) database query, (6) `c.json()` response.

### Context

Scale at analysis (2026-03-24): 22 route files, ~105 endpoints, 6,357 LOC total. The
`describeRoute` block alone accounts for 13–15% of each endpoint's code across all 105
instances. The `responses.200.content["application/json"].schema` nesting within that block is
structurally identical every time.

### Why explicit status quo is the current answer

For an agent-heavy workflow where codebase cold-reads are frequent, the explicit dispatch flow
(every step visible on every endpoint) is readable in a way that helper abstractions obscure.
The `c.req.valid("query" as never) as T` cast (a known Hono-OpenAPI limitation) remains
explicit and auditable rather than hidden inside a factory. No helper convention to document,
maintain, or migrate when Hono or `hono-openapi` changes. Linear maintenance cost: ceremony is
repeated 105 times — real but bounded and entirely mechanical.

The factory approach (Approach C) is **rejected outright** regardless of other conditions: it
creates coupling that forecloses Hono RPC and complicates non-standard endpoints (file upload,
media streaming, webhook verification). See §Approach C below.

## Deferred options

### Approach A — `jsonResponse()` helper (lightest touch)

A single-function shorthand for the deeply nested response object inside `describeRoute`.
Savings: ~5 lines per endpoint × 105 ≈ 525 lines.

**Not adopted because:** Does not address the `describeRoute` wrapper itself, the `validator()`
call, or the auth pattern. Savings are real but modest; the ceremony still reads as a
recognizable pattern.

Available for incremental adoption — one route file at a time, tests unchanged, output
identical — when human collaborators join (the primary revisit trigger).

### Approach B — `describeJson()` wrapper (medium touch)

Combines `describeRoute` and the common response pattern into a single call with an `errors:`
array for standard 4xx codes. Savings: ~8–10 lines per endpoint × 105 ≈ 840–1,050 lines.
Non-standard endpoints (201 creates, media streaming, webhooks) continue using raw
`describeRoute` as the natural escape hatch.

**Not adopted because:** Adds a thin layer of indirection — an agent reading a route cold must
understand what `describeJson` expands to. The expansion is predictable, but it is hidden.
Compatible with OpenAPI codegen and with Hono RPC.

Available for incremental adoption when human-collaborator or bug-pattern conditions trip.

### Approach C — route definition factory (heavier touch) — REJECTED

A factory that assembles the full middleware chain from a declarative options object.

**Rejected outright:** Introduces a framework-within-a-framework. Loses Hono's natural
middleware composition — custom per-route middleware cannot be inserted without extending the
factory signature. The `c.req.valid("query" as never) as T` double-cast moves into the factory,
hiding rather than fixing it. Non-standard endpoints need escape hatches — a two-tier system.
**Conflicts with Hono RPC**: a custom route factory breaks the type inference chain that
`hc<typeof app>()` relies on. If Hono RPC is pursued after route registration is restructured
(per `positions/api-source-of-truth.md` conditions), Approach C would foreclose that option.
Handler body length is unchanged — the savings are only in the ceremony.

If any helper approach is adopted, it must be Approach A or B (metadata helpers only), never
Approach C (factory). The factory forecloses the Hono RPC path.

## Interaction with API source-of-truth (positions/api-source-of-truth.md)

- If OpenAPI codegen is adopted (per `api-source-of-truth.md` revisit), route unification via
  Approach A or B would produce a cleaner, more consistent `describeRoute` annotation surface
  and a cleaner generated spec. The two positions are complementary but neither is a hard
  blocker for the other.
- If Hono RPC is pursued, route registration must use the natural
  `routes.get(path, ...middleware, handler)` pattern. Approaches A and B are compatible;
  Approach C is not.
