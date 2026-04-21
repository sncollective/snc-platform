---
id: feature-refactor-readonly-zod-schemas-decision
kind: feature
stage: drafting
tags: [refactor, stylistic]
release_binding: null
created: 2026-04-20
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: null
---

Zod-inferred types produce mutable properties by default. Several contained fixes have already shipped at specific sites across the codebase, but there is no settled policy for the general case. The codebase-wide decision on how to enforce immutability on Zod-inferred types is unresolved and high-impact — it affects every consumer of the shared package's Zod exports and any inferred types imported into api or web. The design step needs to make the policy call so that a subsequent sweep can run consistently across all affected sites rather than accruing ad-hoc fixes.

## Current state

Individual readonly fixes landed in the Fix lane without a governing policy:

- `playout.ts:53` (web lib) — `reorderPlayoutItems(orderedIds: string[])` parameter tightened to `readonly string[]`
- `streaming.ts:48-71` (web lib) — simulcast CRUD return type properties marked `readonly`
- `content-url.ts:4-8` (web lib) — `params` object properties marked `readonly`
- `calendar-utils.ts:7-24` — `GridCell`, `WeekRow`, `SpanBar` exported interfaces have all properties marked `readonly`

These are manual `readonly` annotations on hand-written interfaces. The structural problem is the shared package's Zod schemas: `z.object({...})` infers mutable types by default. Any type derived via `z.infer<typeof SomeSchema>` exposes mutable fields at every usage site, and each consumer must independently remember to apply `Readonly<>` or otherwise guard against mutation.

Known affected schema exports in the shared package (non-exhaustive — a full audit is part of the design step):

- `content.ts` — `CONTENT_TYPES`, `VISIBILITY`, `CONTENT_STATUSES`, `PROCESSING_STATUSES`, and all object schemas
- `streaming.ts` — `StreamStatusSchema`, `StreamKeyCreatedResponseSchema`, `ActiveStreamSchema`, simulcast schemas
- `simulcast.ts` — `SIMULCAST_PLATFORMS`, `SIMULCAST_PLATFORM_KEYS`
- `playout.ts` — `RENDITION_PROFILES`, `RENDITIONS`, `VIDEO_RENDITIONS`, item schemas
- `emissions.ts` — `EmissionsFileEntrySchema`, `EmissionsSummarySchema`, and 5 sibling schemas
- `calendar.ts`, `booking.ts`, `subscription.ts`, `uploads.ts`, `studio.ts` — object schemas throughout

Downstream consumers that import and `z.infer<>` these schemas across api and web are the true surface — any of them could mutate inferred type values without a type error today.

## Options under consideration

### Option A — `Readonly<>` wrapper at each usage site

Apply `Readonly<z.infer<typeof SomeSchema>>` at every point where the type is consumed — function parameters, return types, local variables.

Trade-offs:

- Explicit at every call site — readers see exactly what the function promises
- Verbose and repetitive; grows with the number of consumers
- Relies on every future consumer remembering to apply the wrapper — no enforcement at source
- Easy to audit mechanically: grep for `z.infer<` and check whether the result is wrapped
- Does not require schema changes; downstream adapters that currently mutate inferred types are unaffected

### Option B — `.readonly()` on schemas in the shared package

Add `.readonly()` to each Zod schema definition in the shared package. Inferred types become `Readonly<{...}>` automatically for all consumers.

Trade-offs:

- Correctness enforced at source; consumers cannot forget
- Invisible at usage sites — the readonly guarantee is implicit, not declared
- Any downstream consumer that currently mutates inferred type properties (e.g., reassigning fields after deserialization, patching objects for tests) breaks at compile time — a full audit is needed before rolling out
- Smaller diff: schema definitions are the single source of change
- Zod `.readonly()` applies shallowly — nested objects are not recursively readonly; deep-mutation paths in adapters may still be valid TypeScript after the change

### Option C — Leave Zod schemas mutable; add `readonly` only on hand-written interfaces

Do not change schema definitions. Continue marking hand-written interface properties `readonly` where they appear. Let `z.infer<>` types remain mutable.

Trade-offs:

- No breaking changes; lowest friction
- The invariant is partial and inconsistent — shared package exports mix readonly (hand-written interfaces) with mutable (inferred types)
- Effectively the status quo; each new consumer that infers from schemas inherits mutable types

## Design questions

1. **Downstream mutation audit.** Before committing to Option B, someone needs to walk all api and web callsites that assign to or destructure-then-reassign properties from Zod-inferred shared types. Are any of those mutations intentional (e.g., adapter layers building up objects incrementally)? If yes, does switching to `.readonly()` force non-trivial rewrites in adapters, or can those sites use local mutable copies and convert at the boundary?

2. **Shallow vs. deep readonly.** Zod's `.readonly()` is shallow. For schemas with nested object properties (e.g., `EmissionsSummarySchema` or calendar event schemas), the outer type becomes `Readonly<{...}>` but nested objects remain mutable. Is shallow enough, or does the design need to specify a convention for deeply nested schemas (`.deepPartial()` analog does not exist in Zod for readonly; manual recursive wrapping would be needed)?

3. **Policy scope.** Should the policy apply to all shared package Zod schemas, or only to schemas that cross a service boundary (shared → api, shared → web)? Schemas used purely for validation at the edge (e.g., request body parsing, where the parsed value is immediately handed to a service) are lower risk for mutation; schemas used as domain types passed across layers are higher risk.

4. **Which option is the call?** Options A and B are both viable. The design step should commit to one and document the rationale so the sweep can run without re-litigating the trade-off at each site.

## Out of scope

- Enforcing deep readonly on hand-written interfaces beyond the existing `calendar-utils.ts` / web-lib fixes already shipped — that is a consequence of whichever policy is chosen, not a separate concern.
- The `as const satisfies` pattern for array constants (tracked separately as `file-utils.ts:14` in the board's Backlog).
- Mutation detection at runtime — this is a static-type-system concern only.
