> **Archived**: 2026-03-06
> **Validation**: All tests passing, no cross-finding regressions

# Refactor Analysis: Middleware

> **Generated**: 2026-03-06
> **Scope**: 7 files analyzed — `apps/api/src/middleware/*.ts` + 6 corresponding test files in `apps/api/tests/middleware/`
> **Libraries researched**: Hono v4.12.2, hono-rate-limiter v0.5.3

---

## Executive Summary

All 7 middleware files were analyzed alongside their 6 test files (the `content-gate.ts` test file covers all three exported functions across separate `describe` blocks). The middleware layer is generally clean and well-tested. Three findings stand out: (1) `rate-limit.ts` throws a bare `AppError` instead of a typed `RateLimitError` subclass — the only place in the codebase that violates the `app-error-hierarchy` pattern; (2) `requireRole` queries the DB for user roles independently from `content-gate.ts`, creating a double `getUserRoles` call on every protected content route that also gates by subscription; (3) the `AuthEnv` type declares `roles` as a guaranteed `Role[]`, but `requireAuth` never sets it — the type implies safety that does not exist at runtime for routes using only `requireAuth`.

---

## P0 — Fix Now

None found.

---

## P1 — High Value

### 1. `AuthEnv.roles` is typed as non-optional but never set by `requireAuth`

- **Location**: `apps/api/src/middleware/auth-env.ts:15`, `apps/api/src/middleware/require-auth.ts`
- **Issue**: `AuthEnv.Variables.roles` is typed as `Role[]` (not `Role[] | undefined`). However, `requireAuth` never calls `c.set("roles", ...)` — only `requireRole` does. Any handler that runs after `requireAuth` alone and calls `c.get("roles")` will receive `undefined` at runtime, but TypeScript believes it is `Role[]`. The comment on `auth-env.ts:8` even advertises this key as safe to read after auth middleware. This is a type-safety gap: the declared contract is wrong.
- **Risk**: Correctness — silent `undefined` where `Role[]` is expected; could cause downstream logic that checks `roles.includes(...)` to throw a runtime TypeError on routes that only mount `requireAuth` and not `requireRole`.
- **Fix**: Two options — pick one:
  - **Option A (additive, minimal)**: Make `roles` optional in `AuthEnv`: `roles?: Role[]`. Any caller must null-check before reading.
  - **Option B (correct by construction)**: Have `requireAuth` call `getUserRoles(user.id)` and `c.set("roles", roles)` immediately after session validation, so `roles` is always populated when `user` is. Then `requireRole` can read from context instead of re-querying. This eliminates the double-query issue in P1.2 below and makes the contract accurate.
- **Estimated scope**: 2 files to change (`auth-env.ts`, `require-auth.ts`); if Option B, also update `require-role.ts` to read `c.get("roles")` instead of calling `getUserRoles` — 3 files total. No public API change.
- **Pattern reference**: `hono-typed-env` — "Forgetting to type `MiddlewareHandler<AuthEnv>` on middleware — `c.set()` then accepts any key/value and loses type safety." Same principle applies in reverse: typing a key that is never set loses safety.
- **Tests affected**: `require-auth.test.ts` (if Option B, assert `roles` is set on context); `require-role.test.ts` (if Option B, remove the DB mock — roles now come from context).
- **Verify**: [x] Tests pass without modification / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-06

---

### 2. Double `getUserRoles` query on subscription-gated content routes

- **Location**: `apps/api/src/middleware/require-role.ts:26`, `apps/api/src/middleware/content-gate.ts:156`
- **Affected files**: `middleware/require-role.ts`, `middleware/content-gate.ts`, `routes/content.routes.ts`
- **Current state**: Routes like `GET /api/content/:id` that use `requireRole("creator")` followed by `checkContentAccess(...)` in the handler body issue two separate `getUserRoles(userId)` DB queries per request — one in `requireRole` and one inside `checkContentAccess` (line 156 of `content-gate.ts`). The same pattern occurs in `buildContentAccessContext` (line 60). This is an N+1 on roles that happens on every request to protected content endpoints.
- **Proposed consolidation**: If P1.1 Option B is adopted (roles set by `requireAuth`), `checkContentAccess` and `buildContentAccessContext` can accept an optional pre-fetched `roles` array rather than querying again. Alternatively, pass roles from the Hono context into the gate functions at the call site. A minimal fix without restructuring `requireAuth`: add an optional `roles?: Role[]` parameter to both `checkContentAccess` and `buildContentAccessContext`; callers that already have roles from context pass them through; the gate functions skip the `getUserRoles` call when provided.
- **Estimated scope**: 3 files (`content-gate.ts`, `content.routes.ts`, `content-gate.test.ts`). Roughly +15 / -5 LOC.
- **Pattern reference**: No existing pattern — "New pattern needed" (or document as an extension of `content-access-gate`).
- **Tests affected**: `content-gate.test.ts` — new test cases for the pre-fetched-roles path.
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-06

---

### 3. ~~`rateLimiter` throws bare `AppError` — violates `app-error-hierarchy` pattern~~ ✅ Implemented

- **Location**: `apps/api/src/middleware/rate-limit.ts:62`
- **Affected files**: `middleware/rate-limit.ts`, `packages/shared/src/errors.ts`
- **Current state**:
  ```typescript
  throw new AppError("RATE_LIMIT_EXCEEDED", "Too many requests", 429);
  ```
  This is the only place in the API codebase where `AppError` is instantiated directly rather than through a named subclass. The `app-error-hierarchy` pattern document explicitly names `RateLimitError` as an example subclass to add.
- **Proposed consolidation**: Add `RateLimitError` to `packages/shared/src/errors.ts`:
  ```typescript
  export class RateLimitError extends AppError {
    constructor(message: string = "Too many requests") {
      super("RATE_LIMIT_EXCEEDED", message, 429);
    }
  }
  ```
  Update `rate-limit.ts` to `throw new RateLimitError()`. Export from `packages/shared/src/index.ts`.
- **Estimated scope**: 3 files (`errors.ts`, `index.ts`, `rate-limit.ts`). ~8 LOC delta.
- **Pattern reference**: `app-error-hierarchy` — "Add a new subclass per distinct error category (e.g., `ConflictError`, `RateLimitError`)".
- **Tests affected**: `rate-limit.test.ts` — test already asserts `body.error.code === "RATE_LIMIT_EXCEEDED"`; behavior unchanged, but can now `instanceof`-check in future.
- **Verify**: [x] Tests pass without modification / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-06

---

## P2 — Medium Value

### 4. ~~`require-role.ts` has an implicit dependency ordering contract with no enforcement~~ ✅ Implemented

- **Location**: `apps/api/src/middleware/require-role.ts:1-39`
- **Affected files**: `middleware/require-role.ts`
- **Issue**: The JSDoc says "Must be chained after `requireAuth`" but nothing in the type system or runtime enforces this. If `requireRole` is used without `requireAuth`, `c.get("user")` returns `undefined`, and `user.id` throws a TypeError that propagates as a 500 instead of a clear auth failure. The `hono-typed-env` pattern relies on the type generic, but since routes compose middleware manually, the ordering is invisible to TypeScript.
- **Suggestion**: Add a runtime guard at the top of the `requireRole` handler: check if `c.get("user")` is defined and throw `UnauthorizedError` (401) if not. This converts the opaque 500 into a meaningful auth error and makes the middleware self-protecting. The type annotation alone is insufficient without a runtime check.
- **Tests affected**: `require-role.test.ts` — add test case for missing user on context returning 401
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-06

### 5. ~~`content-gate.ts` mixed concerns: it is named "middleware" but exports no `MiddlewareHandler`~~ ✅ Implemented

- **Location**: `apps/api/src/middleware/content-gate.ts`
- **Affected files**: `middleware/content-gate.ts`, `routes/content.routes.ts`, `tests/middleware/content-gate.test.ts`
- **Issue**: The file lives in `middleware/` but exports only pure functions (`checkContentAccess`, `buildContentAccessContext`, `hasContentAccess`). There is no `MiddlewareHandler` export. It is really a service/utility module that happens to perform access control. Living in `middleware/` sets a misleading expectation about its interface.
- **Suggestion**: Consider moving to `src/services/content-access.ts` or `src/lib/content-gate.ts`, which better describes its nature as a service function rather than a Hono middleware. Update all import paths (3 affected files). This is a rename/move with no behavioral change.
- **Tests affected**: `tests/middleware/content-gate.test.ts` — move to `tests/services/` or `tests/lib/` to mirror new location; update import paths
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-06

### 6. ~~`cors.ts` reads `config` at module load time — makes test isolation harder than necessary~~ ✅ Implemented

- **Location**: `apps/api/src/middleware/cors.ts:13`
- **Affected files**: `middleware/cors.ts`
- **Issue**: `corsMiddleware` is initialized eagerly at module scope using `config.CORS_ORIGIN`. This is why `cors.test.ts` must use `vi.doMock` + `vi.resetModules()` for every test group, re-importing the module to get different CORS origins. The pattern is functional but adds test complexity.
- **Suggestion**: Wrap in a factory: `export const createCorsMiddleware = (origin: string | string[]) => cors({ origin, ... })` and export a default `corsMiddleware = createCorsMiddleware(parseOrigins(config.CORS_ORIGIN))`. The factory removes the test isolation burden and aligns with how `rateLimiter` is already authored (a factory function). Tests can call `createCorsMiddleware(["http://localhost:3001"])` directly without module reloading.
- **Tests affected**: `cors.test.ts` — simplify to call `createCorsMiddleware()` directly instead of `vi.doMock` + `vi.resetModules()` per test group
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-06

---

## P3 — Nice-to-Have

- `rate-limit.ts:62` — `Retry-After` header uses `String(retryAfter)` but HTTP spec prefers the header name in title-case. Hono's `c.header()` is case-insensitive outbound; this is cosmetic but `Retry-After` is already used correctly in the test assertion (`res.headers.get("Retry-After")`). No change needed.
- `content-gate.ts` — magic string `"public"` and `"subscribers"` appear repeatedly in both `checkContentAccess` and `hasContentAccess`. These are already defined as `VISIBILITY` constants in `@snc/shared/content.ts`. Consider replacing inline strings with `VISIBILITY.public` / `VISIBILITY.subscribers` for refactoring safety.
- `error-handler.ts:40` — the `details` extraction uses `"details" in e ? (e as { details?: unknown }).details : undefined`. If a `ValidationError` subclass with `details` is added to `@snc/shared` in the future, this pattern would need to be updated. Consider adding a `details?: unknown` field to `AppError` base class as an optional property (set to `undefined` by default) rather than using structural duck-typing.
- `require-role.test.ts:57` — `c.set("user", MOCK_USER as any)` uses `as any`. The test would be cleaner if `MOCK_USER` was typed as `User` directly from `makeMockUser()` which already returns the right shape.

---

## Skip — Intentional Patterns

| Pattern | Location | Why it stays |
|---------|----------|-------------|
| `requireAuth` and `requireRole` as separate middleware | `require-auth.ts`, `require-role.ts` | They compose independently; some routes need auth without role enforcement. Separation is correct. |
| `checkContentAccess` and `buildContentAccessContext` as distinct functions | `content-gate.ts` | One is for single-item detail endpoints, the other is a batch pre-fetch for feed list gating. Different performance contracts; merging would force a richer but slower interface on all callers. |
| `hasContentAccess` as a synchronous function | `content-gate.ts` | Pure, synchronous per-item check after context is pre-built. Keeps the feed loop O(1) per item rather than O(n) DB queries. Intentionally separate from the async `checkContentAccess`. |
| `corsMiddleware` as a module-level constant | `cors.ts` | The current approach is documented in `hono-test-app-factory` pattern; `vi.doMock` + `vi.resetModules` is an established tool in this codebase. Only upgrade to factory (P2.3) when touching the file for another reason. |

---

## Best Practices Research

### Hono v4.12.2

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `MiddlewareHandler<AuthEnv>` type annotation on each middleware | `createMiddleware<AuthEnv>()` from `hono/factory` — infers types, reduces boilerplate | Low — drop-in replacement |
| Manual `MiddlewareHandler` type for middleware factories (`requireRole`) | `createMiddleware<Env>()` wrapping the inner handler | Low |
| No `Retry-After` in rate limit response header on non-429s | Current approach (only set on 429) is correct per RFC 6585 | N/A — already correct |

**Note on `createMiddleware`**: Hono's `factory.createMiddleware<Env>()` helper (available since v4.3.0) provides the same type safety as explicit `MiddlewareHandler<Env>` typing with slightly less boilerplate. However, there is an open issue (honojs/hono#3847) documenting that `factory.createMiddleware()` can break RPC client type inference in some configurations. Given that this project does not use Hono RPC, adoption is safe but migration effort is low-value — keep existing pattern.

---

## OSS Alternatives

| Hand-rolled Code | Package | Weekly DL | Stack Fit | Notes |
|-----------------|---------|-----------|-----------|-------|
| `rateLimiter` in `rate-limit.ts` | `hono-rate-limiter` v0.5.3 | ~163 (cloudflare sub-pkg) — main pkg stats not confirmed | Partial | Supports in-memory + Redis stores; API is `express-rate-limit`-compatible. Current hand-rolled implementation is ~67 LOC and well-tested. OSS package adds a store abstraction useful for multi-instance deployments but is v0.5.x (pre-stable). Adopt only when scaling to multiple API instances requiring shared rate limit state (e.g., Redis store). |

---

## Pattern Compliance

| Pattern | Status | Notes |
|---------|--------|-------|
| `app-error-hierarchy` | Fixed | `rate-limit.ts` now uses `RateLimitError` subclass (P1.3 ✅) |
| `hono-typed-env` | Fixed | `requireAuth` now sets `roles` on context after session validation (P1.1 + P1.2 ✅) |
| `result-type` | Compliant | Middleware correctly throws `AppError` subclasses rather than returning `Result<T>` — appropriate for the middleware layer |
| `vi-doMock-dynamic-import` | Compliant | All middleware tests use `vi.doMock` + `vi.resetModules()` pattern correctly |
| `hono-test-app-factory` | Compliant | Each test file builds a local minimal Hono app using the established pattern |

---

## Suggested Implementation Order

1. **P1.1 + P1.2 together** — Fix `AuthEnv.roles` type gap while also making `requireAuth` set roles on context; then update `requireRole` to read from context and `content-gate.ts` to accept optional pre-fetched roles. These are tightly coupled changes that are safer implemented as one PR.
2. **P1.3** — Add `RateLimitError` to `@snc/shared`. Isolated one-file change with zero behavior impact.
3. **P2.1** — Add runtime guard in `requireRole` to throw `UnauthorizedError` if user is not on context. Small safety improvement, no API change.
4. **P2.2** — Rename/move `content-gate.ts` to `src/services/content-access.ts`. Do as part of a broader route refactor to avoid churn.
5. **P2.3** — Refactor `cors.ts` to factory pattern. Opportunistic — do when next touching the CORS config.
