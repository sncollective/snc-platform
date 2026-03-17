> **Archived**: 2026-03-09
> **Validation**: All tests passing, no cross-finding regressions

# Refactor Analysis: Routes

> **Generated**: 2026-03-09
> **Scope**: 15 files — `apps/api/src/routes/*.routes.ts` + `apps/api/src/routes/*.ts` (utils)
> **Libraries researched**: hono v4.12.2, hono-openapi v1.2.0, drizzle-orm v0.45.1

---

## Executive Summary

Analyzed 15 route files totaling ~1,600 lines across 11 domain route modules and 4 utility modules. The utility layer (`openapi-errors.ts`, `cursor.ts`, `file-utils.ts`, `route-utils.ts`) is well-extracted and consistently used. Key findings include: one correctness bug (schema/response field mismatch in emissions breakdown), one intra-file duplication of a 30-line block in `emissions.routes.ts`, two N+1 query patterns (admin list route and emissions breakdown dual-query), a systematic `"as never"` type cast on all paginated query validators (10 occurrences), and a one-off cursor decode in `merch.routes.ts` that bypasses the shared utility.

---

## P0 — Fix Now

### Schema/response mismatch in emissions breakdown

- **Location**: `apps/api/src/routes/emissions.routes.ts:232–240`, `packages/shared/src/emissions.ts:62–77`
- **Issue**: The `/breakdown` handler returns `entryCount` in both `byScope` and `byCategory` arrays, but `EmissionsBreakdownSchema` declares those arrays without `entryCount`. TypeScript's structural typing means the response object is valid at compile time (extra fields are ignored), but the OpenAPI schema and any client consuming `EmissionsBreakdown` will silently drop `entryCount`.
- **Risk**: API contract inconsistency — clients that try to display entry counts by scope or category will get `undefined`; the OpenAPI doc misleads integrators about available fields.
- **Fix**: Add `entryCount: z.number().int()` to both `byScope` and `byCategory` object schemas in `EmissionsSummarySchema` in `packages/shared/src/emissions.ts`. No handler changes needed.
- **Verify**: [x] `pnpm --filter @snc/shared test` passes / [x] No new public APIs / [x] Behavior unchanged (data was already being returned)
- **Implemented**: 2026-03-09

---

## P1 — High Value

### Duplicated emissions summary calculation block

- **Affected files**: `apps/api/src/routes/emissions.routes.ts` (lines 88–130 and 148–178)
- **Current state**: A 30-line block of three DB queries plus derived calculations (`grossCo2Kg`, `netCo2Kg`, `projectedGrossCo2Kg`, `doubleOffsetTargetCo2Kg`, `additionalOffsetCo2Kg`) is copied verbatim between the `/summary` and `/breakdown` handlers. The `/breakdown` handler already needs the summary data to populate its `summary:` key — so the duplication is structurally identical.
- **Proposed consolidation**: Extract a private async helper `fetchEmissionsSummary(): Promise<EmissionsSummary>` that runs the three queries and returns the computed summary object. Both handlers call it. `/summary` returns the result directly; `/breakdown` spreads it into the response envelope. This eliminates 3 duplicate DB queries per `/breakdown` request as a side effect (currently `/breakdown` runs them twice with no benefit).
- **Estimated scope**: 1 file, -30 LOC net.
- **Pattern reference**: `route-private-helpers` — private helper shared across multiple handlers in the same file.
- **Tests affected**: `apps/api/tests/routes/emissions.test.ts` — no structural change to behavior, existing tests should pass unchanged.
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### Admin list route N+1: per-user role queries inside `Promise.all`

- **Affected files**: `apps/api/src/routes/admin.routes.ts` (lines 120–138)
- **Current state**: The `GET /admin/users` handler fetches a page of users, then fires one `SELECT` from `user_roles` per user inside `Promise.all(pagedUsers.map(...))`. A page of 50 users issues 51 DB round-trips (1 for users + 50 for roles). The file already defines `getUserWithRoles(userId)` as a helper but the list route duplicates its inner query inline rather than calling it, and neither path batches.
- **Proposed consolidation**: Add a private `batchGetUserRoles(userIds: string[]): Promise<Map<string, Role[]>>` that does a single `SELECT … WHERE userRoles.userId IN (…)` using `inArray`, then groups results by userId. Call it after the paginated user fetch and map the result — mirroring the `batchGetContentCounts` pattern in `creator.routes.ts`. Also update `getUserWithRoles` to call the batch helper with a single-element array.
- **Estimated scope**: 1 file, +15 LOC for helper, -10 LOC inline mapping. Reduces 50 → 1 role query per page.
- **Pattern reference**: `batchGetContentCounts` in `creator.routes.ts:132` — established precedent using `inArray`.
- **Tests affected**: `apps/api/tests/routes/admin.test.ts` — mock setup for role queries will need to accommodate the batched query form.
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### Merch cursor decode bypasses shared `decodeCursor` utility

- **Affected files**: `apps/api/src/routes/merch.routes.ts` (lines 98–107)
- **Current state**: The merch list handler performs an inline `JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8"))` to extract `endCursor`, swallowing all errors silently with a bare `catch { after = undefined }`. This bypasses `decodeCursor` from `cursor.ts` and duplicates the base64url decode. The merch cursor encodes only `{ endCursor: string }` (a Shopify opaque cursor), not a keyset `{ timestamp, id }`, so `decodeCursor` with its `timestampField`/`idField` contract does not directly apply.
- **Proposed consolidation**: Extend `cursor.ts` with an `decodeRawCursor(cursor: string): Record<string, string>` that decodes base64url and returns the raw JSON object, throwing `ValidationError` on parse failure. The merch handler uses it and extracts `endCursor`, consistent error behavior with the rest of the codebase. Alternatively, if the silent-fail behavior is intentional for Shopify cursors (an invalid Shopify cursor would just restart pagination), add a comment documenting that decision.
- **Estimated scope**: 1 utility file (`cursor.ts`) +8 LOC, 1 route file (`merch.routes.ts`) -5 LOC delta.
- **Pattern reference**: `cursor-encode-decode` — all cursor encode/decode should go through the shared utility.
- **Tests affected**: `apps/api/tests/routes/merch.test.ts` — add test for invalid cursor handling.
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged (or document intentional divergence)
- **Implemented**: 2026-03-09

---

## P2 — Medium Value

### `"as never"` casts on `c.req.valid()` — 10 occurrences across 6 files

- **Location**: All paginated and filtered query validators — `admin.routes.ts:84`, `admin.routes.ts:169`, `admin.routes.ts:218`, `booking.routes.ts:274`, `booking.routes.ts:349`, `content.routes.ts:178`, `content.routes.ts:482`, `creator.routes.ts:268`, `merch.routes.ts:95`, `subscription.routes.ts:125`
- **Affected files**: `admin.routes.ts`, `booking.routes.ts`, `content.routes.ts`, `creator.routes.ts`, `merch.routes.ts`, `subscription.routes.ts`
- **Issue**: `c.req.valid("query" as never)` is a workaround for a known hono-openapi type inference gap (tracked in [rhinobase/hono-openapi#145](https://github.com/rhinobase/hono-openapi/issues/145) and [#192](https://github.com/rhinobase/hono-openapi/issues/192)): when `describeRoute()` wraps a handler, the generic `Input` type from `validator()` is not propagated, so `c.req.valid("query")` produces `never`. The double cast `(c.req.valid("query" as never) as MyType)` bypasses TypeScript without runtime risk, but it's noisy and defeats the compile-time guarantee the pattern is meant to provide.
- **Suggestion**: Track the hono-openapi issue. When a fix lands in hono-openapi (or via a `@hono/zod-validator` + manual OpenAPI approach), remove the casts. In the meantime, extract a one-line typed getter pattern (e.g., a typed wrapper for `c.req.valid`) and document it as the project's canonical workaround in `platform-patterns/hono-typed-env.md`.
- **Tests affected**: None — this is a TypeScript-only change.
- **Verify**: [x] `tsc --noEmit` passes / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09 — documented canonical workaround in `hono-typed-env.md`; no code change (TypeScript-only issue, upstream fix tracked at rhinobase/hono-openapi#145 and #192)

### Creator `PATCH /:creatorId` insert path duplicates `ensureCreatorProfile` logic

- **Location**: `apps/api/src/routes/creator.routes.ts:531–549` vs `ensureCreatorProfile` at lines 63–90
- **Affected files**: `creator.routes.ts`
- **Issue**: The PATCH handler's "else" branch (creating a new profile when none exists) does a raw `db.insert(creatorProfiles)` inline. The existing `ensureCreatorProfile(userId, userName)` helper does the same insert with conflict handling. The inline version differs slightly: it accepts field values from `body` (bio, socialLinks) rather than just `displayName`, so it can't call `ensureCreatorProfile` directly. However, the insert pattern is close enough to cause maintenance drift if the schema changes.
- **Suggestion**: Extend `ensureCreatorProfile` to accept optional field overrides: `ensureCreatorProfile(userId, userName, overrides?: Partial<CreatorProfileInsert>)` so the PATCH handler can delegate. Reduces risk of the two insert paths diverging.
- **Tests affected**: `apps/api/tests/routes/creator.test.ts` — PATCH upsert path tests, no behavior change.
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### Emissions `/breakdown` runs 3 extra DB queries already fetched by `/summary`

- **Location**: `apps/api/src/routes/emissions.routes.ts:148–177` (covered by P1 extraction above)
- **Affected files**: `emissions.routes.ts`
- **Issue**: Already flagged as P1 duplication. As a standalone P2: if the summary helper from P1 is not extracted, `/breakdown` still redundantly issues 3 DB queries (gross, projected, offset) whose results it uses only to compute the `summary:` key — then issues 4 more queries for `byScope`, `byCategory`, `monthly`, `entries`. This is 7 queries per request where 4 suffice.
- **Suggestion**: Implement the `fetchEmissionsSummary()` extraction from P1.
- **Tests affected**: See P1.
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09 — resolved as a side-effect of P1 extraction

### Subscription `POST /cancel`: unsafe non-null assertion on `plan!`

- **Location**: `apps/api/src/routes/subscription.routes.ts:291`
- **Affected files**: `subscription.routes.ts`
- **Issue**: After canceling on Stripe and updating the DB, the handler fetches the plan via `db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, sub.planId))`. The result is destructured as `const [plan]` and then passed as `plan!` to `toSubscriptionWithPlanResponse`. If the plan row was deleted between the subscription lookup and the plan fetch (unlikely but possible in admin scenarios), the `!` assertion causes a silent `undefined` to propagate into the transformer, producing a runtime error that bypasses the structured error handler.
- **Suggestion**: Add `if (!plan) throw new NotFoundError("Subscription plan not found")` before the response. This converts a potential unhandled TypeError into a structured 404.
- **Tests affected**: `apps/api/tests/routes/subscription.test.ts` — add a test for the plan-not-found case.
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P3 — Nice-to-Have

- **`emissions.routes.ts:24`**: `EmissionRow` interface is a manual duplicate of `typeof emissions.$inferSelect`. Use `type EmissionRow = typeof emissions.$inferSelect` instead to stay in sync with schema changes automatically.
- **`admin.routes.ts:86`**: `conditions` starts as an empty array `[]` with no type annotation; TypeScript infers `never[]`. Annotate as `const conditions: SQL[] = []` to make the type explicit and match the pattern used in `booking.routes.ts` and `content.routes.ts`.
- **`emissions.routes.ts:119–130`**: `totalCo2Kg` and `netCo2Kg` are both included in the `/summary` JSON response with the same value. The schema defines both fields separately. Consider removing `totalCo2Kg` from the response and schema or aliasing it; keeping both invites client confusion. (Requires a coordinated shared-schema + route + frontend change.)
- **`content.routes.ts:178`**: The feed query handler extracts `type: typeFilter, creatorId: creatorIdFilter` as renamed destructured fields — the rename adds mild cognitive overhead. The filtering variables could keep original names (`type`, `creatorId`) since they don't shadow anything in the handler scope.
- **`creator.routes.ts:125`**: `socialLinks: (profile.socialLinks as import("@snc/shared").SocialLink[]) ?? []` — inline type assertion imports `SocialLink` with a non-standard inline `import()` expression. Import `SocialLink` at the top of the file with the other `@snc/shared` imports.
- **`auth.routes.ts:42` and `auth.routes.ts:79`**: `// @ts-expect-error` on `resolver()` in `requestBody` appears twice. If the underlying hono-openapi issue is ever fixed, these suppressions will become stale errors. Document the open issue reference in a comment.

---

## Skip — Intentional Patterns

| Pattern | Location | Why it stays |
|---------|----------|-------------|
| Per-domain `toXxxResponse` transformers | `booking.routes.ts`, `content.routes.ts`, `creator.routes.ts`, `subscription.routes.ts` | Intentional per `row-to-response-transformer` — transformers are file-private and should not be shared across route files |
| `handleImageUpload(c, field)` in `creator.routes.ts` | `creator.routes.ts:150` | Intentional per `upload-replace-workflow` — parameterized private handler is the documented pattern |
| `resolveContentUrls` + `resolveFeedItem` composing transformer | `content.routes.ts:61–118` | Intentional per `row-to-response-transformer` example 3 — URL derivation from storage keys |
| Separate `ServiceDetailResponseSchema` inline schema | `booking.routes.ts:116` | Intentional — per pattern comment in the file, matches `CancelResponseSchema` pattern in `subscription.routes.ts`; only used by one endpoint |
| `bookingRequests.status !== "pending"` inline check (not a shared helper) | `booking.routes.ts:491` | Single-use business logic — not repeated elsewhere, premature extraction would add indirection |
| Public `/api/emissions/summary` and `/api/emissions/breakdown` endpoints | `emissions.routes.ts:73, 133` | Intentional transparency — the cooperative publishes its CO2 data publicly per org charter commitment; write endpoints (`/entries`, `/offsets`) are admin-gated |
| Merch cursor uses Shopify `endCursor` opaque string vs. keyset timestamp+id | `merch.routes.ts` | Different cursor semantics — Shopify manages its own pagination state; keyset cursors apply only to local DB queries. The silent-fail on invalid cursor may or may not be intentional (see P1 finding). |

---

## Best Practices Research

### hono v4.12.2

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `c.req.valid("query" as never) as MyType` — double cast workaround | Tracked upstream: [rhinobase/hono-openapi#145](https://github.com/rhinobase/hono-openapi/issues/145), [#192](https://github.com/rhinobase/hono-openapi/issues/192). No clean fix available in hono-openapi v1.2.0 without switching to `@hono/zod-openapi` (different lib). Current workaround is the pragmatic choice. | Low — no action now; revisit when hono-openapi releases a fix |
| Error handling via `throw AppError` caught by global `errorHandler` | Compliant with Hono best practices — `app.onError()` is the correct hook | None |
| `Hono<AuthEnv>` typed context on all auth-gated routers | Compliant with `hono-typed-env` pattern | None |

### drizzle-orm v0.45.1

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `Promise.all(items.map(id => db.select().from(userRoles).where(eq(...id))))` in admin list | Use `inArray()` single batch query — O(1) DB round trips vs O(N). Pattern already established in `creator.routes.ts:batchGetContentCounts` | Low — see P1 finding |
| Raw `db.select()` chains with manual relationship assembly | Drizzle Relational Queries v2 (`db.query.table.findMany`) can handle nested relations automatically. However, the codebase's explicit query style is more testable with the `drizzle-chainable-mock` pattern. Not recommended to migrate. | High — skip |

---

## OSS Alternatives

No candidates identified. The hand-rolled cursor utility, file streaming, and upload flow are well-suited to the codebase's existing patterns and dependencies. No OSS package would improve on the current implementation without adding a significant dependency.

---

## Pattern Compliance

| Pattern | Status | Notes |
|---------|--------|-------|
| `row-to-response-transformer` | Compliant | All route files define private `toXxxResponse()` functions with proper Date → ISO string conversion and storage key → URL derivation |
| `route-private-helpers` | Compliant | Private helpers are unexported; `ERROR_4xx` constants are imported from `openapi-errors.ts` (shared module) per the established split |
| `upload-replace-workflow` | Compliant | `handleImageUpload(c, field)` in `creator.routes.ts` follows the full 10-step sequence; content upload handler follows the same sequence with dynamic constraints |
| `cursor-encode-decode` | Fixed | `decodeRawCursor` added to `cursor.ts`; `merch.routes.ts` now calls it instead of inline base64url decode (P1 finding) |
| `hono-typed-env` | Compliant | All auth-gated route groups use `Hono<AuthEnv>`; unauthenticated routers (`meRoutes`, `webhookRoutes`, `authRoutes`, `merchRoutes`) correctly omit the type parameter |
| `drizzle-chainable-mock` | N/A (routes, not tests) | N/A |
| `webhook-idempotent-dispatch` | Compliant | `webhook.routes.ts` follows the 4-step flow exactly |
| `content-access-gate` | Compliant | `content.routes.ts` uses `checkContentAccess` and `buildContentAccessContext` from `services/content-access.ts` |

---

## Suggested Implementation Order

1. **P0 — Schema fix** (`packages/shared/src/emissions.ts`): Add `entryCount` to `byScope` and `byCategory` schemas — zero-risk, one-file change, fixes an active contract bug.
2. **P1 — Emissions summary extraction** (`emissions.routes.ts`): Extract `fetchEmissionsSummary()` — eliminates 3 redundant DB queries per `/breakdown` request and the 30-line duplication.
3. **P1 — Admin N+1 batch fix** (`admin.routes.ts`): Add `batchGetUserRoles()` using `inArray` — significant performance win for any page size > 1.
4. **P2 — Subscription plan null guard** (`subscription.routes.ts`): Add a 2-line guard before `plan!` assertion — trivial change, eliminates an unhandled runtime error path.
5. **P1 — Merch cursor utility alignment** (`cursor.ts`, `merch.routes.ts`): Add `decodeRawCursor` or document the divergence — improves codebase consistency.
6. **P2 — Creator `ensureCreatorProfile` extension** (`creator.routes.ts`): Consolidate insert paths — reduces future schema-drift risk.
7. **P3 — `EmissionRow` type alias** (`emissions.routes.ts`): Replace manual interface with `$inferSelect` — 1-line change, prevents schema drift.
8. **P2 — `"as never"` cast tracking**: Document in `hono-typed-env.md` as known workaround with upstream issue reference; no code change now.
