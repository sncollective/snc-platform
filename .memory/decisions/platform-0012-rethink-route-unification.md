---
id: platform-0012
title: Route handler ceremony — helper abstraction vs status quo (neutral, status quo retained)
status: active
created: 2026-04-20
updated: 2026-04-20
supersedes: []
superseded_by: null
revisit_if:
  - "Human collaborators join the codebase and find the explicit 6-step ceremony noisy rather than readable"
  - "A recurring bug pattern is traced to a forgotten ceremony step (e.g. missing validator() call, wrong auth middleware)"
  - "A fast-iterating feature area identifies the boilerplate as a concrete velocity blocker"
---

## Context

Every API endpoint in the platform follows a 6-step ceremony: (1) `describeRoute()` OpenAPI metadata block (~10-15 lines), (2) `validator()` input schema, (3) auth middleware (`requireAuth` / `requireRole()` / `optionalAuth` / none), (4) parse validated input via `c.req.valid()`, (5) query the database, (6) return `c.json()`.

Scale at the time of analysis (2026-03-24): 22 route files, ~105 endpoints, 6,357 LOC total. The `describeRoute` block alone — which varies only in `description`, `tags`, response schema, and which `ERROR_4xx` constants apply — accounts for 13-15% of each endpoint's code across all 105 instances. The `responses.200.content["application/json"].schema` nesting within that block is structurally identical every time.

The analysis was conducted under the unification lens on 2026-03-24.

## Alternatives considered

### `jsonResponse()` helper — lightest touch (Approach A)

A single-function shorthand for the deeply nested response object inside `describeRoute`:

```typescript
export const jsonResponse = (schema: any, description: string) => ({
  description,
  content: { "application/json": { schema: resolver(schema) } },
});
```

**Savings.** ~5 lines per endpoint × 105 endpoints ≈ 525 lines. The `describeRoute` call itself and the `validator()` / auth / handler pattern remain explicit.

**Trade analysis.**
- Virtually zero risk — a one-line function replacing a nested object literal with no behavioral change and no type complexity.
- Does not address the `describeRoute` wrapper itself, the `validator()` call, or the auth pattern.
- Incremental: one route file at a time, tests unchanged, output identical.
- Compatible with all three client approaches (hand-written, OpenAPI codegen, Hono RPC) because `describeRoute` metadata is preserved.

### `describeJson()` wrapper — medium touch (Approach B)

Combines `describeRoute` and the common response pattern into a single call:

```typescript
export const describeJson = (opts: {
  description: string;
  tags: string[];
  responseSchema: any;
  responseDescription?: string;
  errors?: number[];
}) =>
  describeRoute({
    description: opts.description,
    tags: opts.tags,
    responses: {
      200: jsonResponse(opts.responseSchema, opts.responseDescription ?? "Success"),
      ...(opts.errors?.includes(400) && { 400: ERROR_400 }),
      ...(opts.errors?.includes(401) && { 401: ERROR_401 }),
      ...(opts.errors?.includes(403) && { 403: ERROR_403 }),
      ...(opts.errors?.includes(404) && { 404: ERROR_404 }),
    },
  });
```

**Savings.** ~8-10 lines per endpoint × 105 ≈ 840-1,050 lines. Still a wrapper, not a framework — escape hatch is "use raw `describeRoute` for non-standard responses."

**Trade analysis.**
- Low risk overall; non-standard endpoints (201 creates, media streaming, webhooks, `.ics` feeds) continue using raw `describeRoute` naturally.
- A + B together cover ~80% of endpoints; the remaining ~20% with non-standard response codes or non-JSON responses stay on raw `describeRoute`.
- Adds a thin layer of indirection: an agent reading a route cold must understand what `describeJson` expands to rather than reading the expansion directly. The expansion is a predictable pattern, but it is hidden.
- Compatible with OpenAPI codegen (spec generation reads `describeRoute` metadata regardless of assembly) and with Hono RPC (natural `routes.get(path, ...middleware, handler)` pattern is preserved).

### Route definition factory — heavier touch (Approach C)

A factory that assembles the full middleware chain from a declarative options object:

```typescript
export const defineRoute = <TQuery, TBody>(opts: {
  method: "get" | "post" | "patch" | "delete";
  path: string;
  description: string;
  tags: string[];
  responseSchema: any;
  querySchema?: ZodSchema<TQuery>;
  bodySchema?: ZodSchema<TBody>;
  auth?: "required" | "optional" | "none";
  roles?: string[];
  handler: (c: Context, input: { query?: TQuery; body?: TBody }) => Promise<Response>;
}) => { /* assembles middleware chain */ };
```

**Savings.** ~10-15 lines per endpoint — most aggressive reduction.

**Trade analysis.**
- Introduces a framework-within-a-framework: the factory's generics for mixed query/body/param inputs get complex quickly. TypeScript inference across the combined generic signature is not trivial.
- Loses Hono's natural middleware composition — custom per-route middleware cannot be inserted without extending the factory signature.
- The `c.req.valid("query" as never) as T` double-cast (a known Hono-OpenAPI limitation) moves into the factory, hiding rather than fixing it.
- Non-standard endpoints (file upload, media streaming, webhook verification) need escape hatches — a two-tier system where some routes use the factory and some don't.
- Conflicts with Hono RPC: a custom route factory would break the type inference chain that `hc<typeof app>()` relies on. If Hono RPC is pursued after route registration is restructured (per the API source-of-truth decision, platform-0011), this factory forecloses that option.
- Handler body length is unchanged — the savings are only in the ceremony, which Approaches A + B already address without the coupling cost.

### Status quo — explicit 6-step pattern

Keep the full ceremony as-is: `describeRoute()` block → `validator()` → auth middleware → `c.req.valid()` → query → `c.json()`.

**Trade analysis.**
- Maximally explicit: an agent reading a route file cold sees the full dispatch flow — metadata, validation target, auth requirement, and handler body — without understanding any helper convention.
- No indirection: the code is its own documentation. Each step is visible, independently auditable.
- The `c.req.valid("query" as never) as T` cast is exposed rather than hidden — an agent can see and reason about the workaround directly.
- Linear maintenance cost: ceremony is repeated 105 times. The cost is real but bounded and entirely mechanical — no logic lives in the ceremony, only structure.
- Agent readability benefit is asymmetric: helpers reduce human visual noise; agents reading code cold benefit from seeing the full pattern rather than resolving helper indirection.

## Decision

**Neutral — status quo retained for now.** The explicit 6-step handler ceremony is kept without helper abstraction.

The analysis showed that Approaches A and B together would eliminate ~1,050-1,575 lines of structural repetition across 105 endpoints with low implementation risk. However, the remaining ceremony (validator, auth, handler) stays the same length regardless of approach — the savings are in OpenAPI metadata wrapping, not in the logic that varies. For an agent-heavy workflow where codebase cold-reads are frequent, the explicit dispatch flow (every step visible on every endpoint) is readable in a way that helper abstractions obscure. The factory approach (C) is rejected outright as it creates coupling that forecloses Hono RPC and complicates non-standard endpoints.

Net: neutral for the current single-agent-plus-owner setup. Neither helper approach is rejected for future use; both are deferred until the human-collaborator or bug-pattern conditions in `revisit_if` trip.

## Revisit if

- Human collaborators join the codebase. Experienced developers skimming route files find the 6-step ceremony noisy rather than informative — the helpers become a readability improvement for them that doesn't cost agent explicitness (because collaborators can establish the helper convention as shared vocabulary quickly). At that point, Approach A or B is the natural starting point.
- A recurring bug pattern is traced to a forgotten ceremony step — a missing `validator()` call that lets unvalidated input through to the handler, or the wrong auth middleware on a protected endpoint. If ceremony omission causes bugs, a factory that enforces the ceremony becomes a correctness argument, not just a brevity argument.
- A fast-iterating feature area identifies boilerplate as a concrete velocity blocker — e.g., scaffolding 10 new endpoints in a sprint where the ceremony becomes the bottleneck rather than the handler logic.

If Hono RPC becomes viable after route registration is restructured (per platform-0011 conditions), ensure any helper approach introduced before that point uses Approach A or B (metadata helpers only) rather than Approach C (factory). The factory forecloses the Hono RPC path.

## Consequences

**Retained from status quo:**
- Full dispatch flow visible on every endpoint — an agent reading cold sees `describeRoute` → `validator` → auth → handler without resolving any helper convention.
- The `c.req.valid("query" as never) as T` cast pattern (Hono-OpenAPI limitation) remains explicit and auditable rather than hidden inside a factory.
- No helper convention to document, maintain, or migrate when Hono or `hono-openapi` changes.

**Deferred:**
- ~1,050-1,575 lines of structural repetition remain across 105 endpoints. Acceptable at current scale; the argument flips when human collaborators are present.
- Approach A (`jsonResponse` helper) and Approach B (`describeJson` wrapper) are fully documented and can be adopted incrementally — one route file at a time — when conditions warrant. No test changes needed; generated spec output is identical.
- Approach C (factory) is noted as incompatible with Hono RPC and is not recommended as a future path regardless of other conditions.

**Interaction with platform-0011 (API source of truth):**
- If OpenAPI codegen is adopted (platform-0011 revisit), route unification via Approach A or B would produce a cleaner, more consistent `describeRoute` annotation surface and a cleaner generated spec. The two decisions are complementary but neither is a hard blocker for the other.
- If Hono RPC is pursued (platform-0011 revisit), route registration must use the natural `routes.get(path, ...middleware, handler)` pattern. Approach A and B are compatible; Approach C is not.
