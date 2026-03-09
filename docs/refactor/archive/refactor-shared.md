> **Archived**: 2026-03-09
> **Validation**: All tests passing, no cross-finding regressions

# Refactor Analysis: Shared Package

> **Generated**: 2026-03-08
> **Scope**: 14 files — `packages/shared/src/*.ts` (plus 11 test files in `packages/shared/tests/`)
> **Libraries researched**: Zod v4.3.6

---

## Executive Summary

The `@snc/shared` package is well-structured and consistently follows the established project patterns. Analysis found no P0 issues. Three meaningful findings span P1–P2: a spurious `hono` dependency with no usage, a `datetime` inconsistency between booking and auth schemas that silently changes validation semantics, and two structurally identical pagination query schemas in `booking.ts` that represent a missed extraction opportunity. Several P3 items round out the report.

---

## P0 — Fix Now

None found.

---

## P1 — High Value

### Unused `hono` dependency in `@snc/shared`

- **Affected files**: `packages/shared/package.json`
- **Current state**: `hono` is listed under `dependencies` (not `devDependencies`) in the shared package. No `import` from `"hono"` exists anywhere in `packages/shared/src/*.ts`. The package ships with Hono bundled transitively for every consumer, including `apps/web`.
- **Proposed consolidation**: Remove `"hono"` from `packages/shared/package.json` dependencies entirely. If Hono types are needed in the future for OpenAPI response shapes, add it as a `peerDependency` or `devDependency` only.
- **Estimated scope**: 1 file, 1-line change; no LOC delta to application code.
- **Pattern reference**: No existing pattern; this is a stale dependency.
- **Tests affected**: None — no shared test imports Hono.
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P2 — Medium Value

### Datetime validation inconsistency: `z.string().datetime()` vs `z.iso.datetime()`

- **Location**: `packages/shared/src/booking.ts:18,19,31,32` vs `packages/shared/src/auth.ts:23,24,31`
- **Affected files**: `booking.ts`, `auth.ts` (and by extension any consumer validating these fields)
- **Issue**: `auth.ts` uses the Zod 4 canonical form `z.iso.datetime()` for `createdAt`/`updatedAt`/`expiresAt`. `booking.ts` uses the older `z.string().datetime()` form on `ServiceSchema` and `BookingRequestSchema` timestamp fields. In Zod 4, `z.string().datetime()` is deprecated in favour of `z.iso.datetime()`. The semantics are slightly different: `z.iso.datetime()` enforces stricter ISO 8601 compliance and has better error messages. `content.ts`, `subscription.ts`, `creator.ts`, `merch.ts`, `admin.ts`, `dashboard.ts`, and `emissions.ts` all use plain `z.string()` (no datetime constraint at all) for their timestamp fields — a separate but related inconsistency noted below.
- **Suggestion**: Replace `z.string().datetime()` in `booking.ts` (lines 18, 19, 31, 32) with `z.iso.datetime()` to match `auth.ts`. Consider whether response schemas in other files (`content.ts`, `subscription.ts`, etc.) also warrant `z.iso.datetime()` on their `createdAt`/`updatedAt` fields — currently those are unconstrained `z.string()`, which accepts any string.
- **Tests affected**: `packages/shared/tests/booking.test.ts` — test fixtures already pass ISO 8601 strings, so no test data changes are expected. Run `pnpm --filter @snc/shared test` to confirm.
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

### Identical pagination query schemas in `booking.ts`

- **Location**: `packages/shared/src/booking.ts:49-52` and `booking.ts:75-78`
- **Affected files**: `booking.ts` only
- **Issue**: `MyBookingsQuerySchema` and `PendingBookingsQuerySchema` are structurally identical:
  ```typescript
  // Both expand to:
  z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  ```
  They are separate exports because they apply to different endpoints (`/bookings/mine` and `/bookings/pending`), and they infer separate TypeScript types (`MyBookingsQuery` vs `PendingBookingsQuery`). A requirements change — e.g., raising the max limit for pending bookings — would currently require updating only one, but a developer would need to know both exist.
- **Suggestion**: Define a single private `BookingPaginationQuerySchema` and assign it to both exports:
  ```typescript
  const BookingPaginationQuerySchema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  });
  export const MyBookingsQuerySchema = BookingPaginationQuerySchema;
  export const PendingBookingsQuerySchema = BookingPaginationQuerySchema;
  ```
  Both `z.infer<>` types will remain distinct type aliases, and all existing exports remain unchanged. **Only do this if the two schemas are expected to always remain identical.** If pending bookings may need different pagination limits in the future (e.g., admin view with higher limit), keep them separate and document the intent.
- **Tests affected**: `packages/shared/tests/booking.test.ts` — no changes required since exported names are unchanged.
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

### `AssignRoleRequestSchema` and `RevokeRoleRequestSchema` are structurally identical

- **Location**: `packages/shared/src/admin.ts:21-27`
- **Affected files**: `admin.ts`, `apps/api/src/routes/admin.routes.ts`
- **Issue**: Both schemas are `z.object({ role: RoleSchema })`. They exist as separate schemas because assign and revoke are separate operations, and the route file uses them as separate validators. However, a single `RoleOperationRequestSchema` (or `RoleBodySchema`) could serve both, with the semantic distinction carried only by the route method.
- **Suggestion**: Evaluate whether the distinction is meaningful to consumers. If `admin.routes.ts` or any other consumer needs to distinguish them by type, keep them separate. If the only usage is as `zValidator` input, consolidate into one `RoleBodySchema` and alias both names from it — or drop one name and update `admin.routes.ts` to import the single schema.
- **Tests affected**: None currently (no `admin.ts` test file in `packages/shared/tests/`).
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P3 — Nice-to-Have

- **`emissions.ts:24,39`**: The inline `YYYY-MM-DD` regex `/^\d{4}-\d{2}-\d{2}$/` is duplicated between `CreateEmissionEntrySchema` and `CreateOffsetEntrySchema`. Extract to a named `DATE_REGEX` constant at the top of the file (or use Zod 4's `z.iso.date()`) so the intent is self-documenting and a change to date validation only requires one edit. — **Implemented 2026-03-09**

- **`emissions.ts:7`**: `EmissionEntrySchema.date` is validated as plain `z.string()` with only a comment `// "YYYY-MM-DD"`. The sibling create schemas validate this field with a regex. Align the response schema to also use the regex (or `z.iso.date()`) so round-trip validation is consistent. — **Implemented 2026-03-09**

- **`booking.ts:68`**: `RequesterSchema.email` is `z.string()` — no `.email()` constraint. The `UserSchema` in `auth.ts` uses `z.string().email()`. A malformed email from the database would pass the `RequesterSchema` validator. Consider adding `.email()` to match `auth.ts`. — **Implemented 2026-03-09**

- **`shared-validation-constants.md` pattern file**: The `shared-validation-constants` pattern document still references `BANDCAMP_URL_REGEX` and `BANDCAMP_EMBED_REGEX` as the canonical example. `creator.ts` has been refactored to a more general `PLATFORM_CONFIG` with per-platform `urlPattern` regex fields — neither `BANDCAMP_URL_REGEX` nor `BANDCAMP_EMBED_REGEX` is exported anymore. The pattern doc example code will fail if a reader tries to import those constants. Update `.claude/skills/platform-patterns/shared-validation-constants.md` with current examples from `PLATFORM_CONFIG` / `SOCIAL_PLATFORMS`. — **Implemented 2026-03-09**

- **`CLAUDE.md` key directory notes**: The `creator.schema.ts` and `creator.routes.ts` descriptions in `platform/CLAUDE.md` still reference `bandcampUrl`, `bandcampEmbeds JSONB`, and Bandcamp-specific fields — the schema has been replaced with the generalized `SOCIAL_PLATFORMS` / `SocialLink` model. Update the CLAUDE.md description lines for `creator.schema.ts`, `creator.routes.ts`, and `creator.tsx` to reflect the current social links model. — **Implemented 2026-03-09**

---

## Skip — Intentional Patterns

| Pattern | Location | Why it stays |
|---------|----------|-------------|
| `MyBookingsResponseSchema` and `PendingBookingsResponseSchema` both use `{ items: [...], nextCursor }` | `booking.ts:58-83` | The item types differ (`BookingWithService` vs `PendingBookingItem`); consolidation would require a generic wrapper and is not worth the complexity. |
| `z.string()` (unconstrained) on `createdAt`/`updatedAt` in response schemas (`content.ts`, `subscription.ts`, `merch.ts`, etc.) | Multiple files | Response schemas validate API output shapes, not raw DB values. The API layer converts `Date` objects to ISO strings before returning. A loose `z.string()` is pragmatic for response validation; adding `z.iso.datetime()` would tighten safety but is a separate deliberate decision. Flagged in P2 but kept out of P0 because no data is currently malformed. |
| `CreatorListItemSchema = CreatorProfileResponseSchema` (alias, not a copy) | `creator.ts:124` | This is intentional schema aliasing — the test confirms `CreatorListItemSchema === CreatorProfileResponseSchema`. Not duplication. |
| Separate `Ok<T>` / `Err<E>` type exports alongside `Result<T,E>` | `result.ts` | Consumers may need to type-narrow to the individual branches. These are the constituent types of the union, not duplicate representations. |
| Date regex inline in `emissions.ts` vs `z.iso.datetime()` elsewhere | `emissions.ts` | Emissions date fields are YYYY-MM-DD (date-only), not full datetime. `z.iso.datetime()` would be wrong here. The correct replacement is `z.iso.date()` — covered in P3. |

---

## Best Practices Research

### Zod v4.3.6

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `z.string().datetime()` in `booking.ts` | `z.iso.datetime()` — canonical Zod 4 form; `z.string().datetime()` is deprecated in v4 | Low — find/replace in `booking.ts` + run tests |
| Inline YYYY-MM-DD regex in `emissions.ts` | `z.iso.date()` — built-in Zod 4 ISO 8601 date validator (`z.iso.date()` accepts `2026-03-08` format) | Low — 2 lines in `emissions.ts` |
| `@snc/shared` imports full `"zod"` (not `"zod/mini"`) | Correct — `zod/mini` should only be used in `apps/web` for bundle size; shared schemas consumed by both API and web should use full Zod. The pattern doc correctly notes this. | N/A — already correct |
| Reusing schema objects vs re-defining | The codebase correctly uses `.extend()` for composition (`BookingWithServiceSchema`, `PendingBookingItemSchema`, `UserSubscriptionWithPlanSchema`, `FeedItemSchema`). No violations found. | N/A — already correct |

---

## OSS Alternatives

No hand-rolled code was found that has a well-maintained OSS equivalent warranting a swap recommendation. The `Result<T,E>` implementation is intentionally minimal by design (per `result-type.md` pattern).

---

## Pattern Compliance

| Pattern | Status | Notes |
|---------|--------|-------|
| `result-type` | Compliant | `result.ts` exactly matches the documented pattern |
| `app-error-hierarchy` | Compliant | `errors.ts` matches; `RateLimitError` is a well-formed addition not yet in the pattern doc but follows the convention |
| `shared-validation-constants` | Fixed | Pattern doc updated to reference `PLATFORM_CONFIG` / `SOCIAL_PLATFORMS` with current examples from `creator.ts`. |

---

## Suggested Implementation Order

1. **Remove `hono` from `packages/shared/package.json` dependencies** (P1) — zero risk, reduces bundle footprint for web consumers.
2. **Replace `z.string().datetime()` with `z.iso.datetime()` in `booking.ts`** (P2) — one file, low risk, aligns with Zod 4 canonical form.
3. **Update `shared-validation-constants.md`** (P3) — prevents future confusion; the doc is actively referenced by the skill system.
4. **Update `CLAUDE.md` creator description lines** (P3) — keeps the AI context accurate for future sessions.
5. **Add `.email()` to `RequesterSchema.email` in `booking.ts`** (P3) — defensive tightening, one character change.
6. **Extract `DATE_REGEX` / switch to `z.iso.date()` in `emissions.ts`** (P3) — minor, do when next touching that file.
7. **Evaluate `AssignRoleRequestSchema`/`RevokeRoleRequestSchema` consolidation** (P2) — lower urgency; only affects `admin.ts` and one route file.
