> **Archived**: 2026-03-09
> **Validation**: All tests passing, no cross-finding regressions

# Refactor Report: `apps/web/src/lib/`

**Scope**: `apps/web/src/lib/*.ts` (18 files)
**Date**: 2026-03-09
**Archive context**: 6 prior scopes archived (components, hooks, middleware, routes, shared, tests). This is the first analysis of `lib`.

---

## Executive Summary

The lib layer is well-structured overall -- most API client modules follow the `web-fetch-client` pattern cleanly. The main findings are:

1. **`cancelSubscription` bypasses `apiMutate`** in `subscription.ts`, using raw `fetch` with manual `throwIfNotOk` (pattern violation, P1).
2. **`formatCo2` vs `formatCo2Kg` near-duplication** across `format.ts` and `chart-math.ts` -- same concept (format CO2 kilograms), different output format (P2).
3. **`api-server.ts` duplicates error extraction and base URL resolution** inline in both `fetchApiServer` and `fetchAuthStateServer` (P2).
4. **`buildMediaUrl` is an identity function** -- the URL-prepending logic was removed but the function and all 7+ call sites remain as a no-op passthrough (P2).
5. **`web-fetch-client` pattern doc is stale** -- references `API_BASE_URL` and `new URL()` construction that no longer exist in the implementation (P2).
6. **Missing test coverage** for 8 of 18 lib files: `fetch-utils.ts`, `subscription.ts`, `merch.ts`, `content.ts`, `admin.ts`, `emissions.ts`, `config.ts`, `form-utils.ts` (P3).

---

## P0 Fix Now

No security risks or correctness bugs found.

---

## P1 High Value

### P1-1: `cancelSubscription` bypasses `apiMutate` (pattern violation)

**File**: `apps/web/src/lib/subscription.ts:63-76`

`cancelSubscription()` uses raw `fetch()` with manual `throwIfNotOk()` instead of `apiMutate`. Every other mutation in the lib layer uses `apiMutate`. This violates the `web-fetch-client` pattern and creates a maintenance risk -- if `apiMutate` behavior changes (e.g. adding retry logic, error enrichment), this function won't get the update.

**Fix**: Replace with `apiMutate<void>("/api/subscriptions/cancel", { body: { subscriptionId } })`. Note: `apiMutate` currently calls `response.json()` unconditionally, so the endpoint must return a JSON body (even `{}`) for this to work. If the endpoint returns 204 No Content, `apiMutate` would need a small enhancement (see P2-4).

**Affected patterns**: `web-fetch-client`

- **Implemented**: 2026-03-09

---

## P2 Medium Value

### P2-1: `formatCo2` / `formatCo2Kg` near-duplication

**Files**: `apps/web/src/lib/format.ts:92-96` and `apps/web/src/lib/chart-math.ts:27-32`

Both functions format CO2 kilograms as human-readable strings. They differ only in output format:
- `formatCo2(kg)`: returns `"X g"` or `"X kg"` (auto-scales g vs kg)
- `formatCo2Kg(kg)`: returns `"X kg"` always (with varying decimal precision, appends unit)

These serve different display contexts (summary cards vs chart axis labels), but both express the same concept: "format a CO2 kilogram value as a string with unit." A single function with an options parameter (e.g. `{ alwaysKg?: boolean }`) could unify them, or `formatCo2Kg` could be refactored to call `formatCo2` with a flag.

**Fix**: Consolidate into `format.ts` with an optional parameter, or rename `formatCo2Kg` to make the distinction clearer (e.g. `formatCo2AxisLabel`) and document the relationship.

- **Implemented**: 2026-03-09

### P2-2: `api-server.ts` internal duplication

**File**: `apps/web/src/lib/api-server.ts`

Both `fetchApiServer` and `fetchAuthStateServer` contain identical blocks for:
1. **Base URL resolution** (lines 17-24 and lines 56-62): reading `API_INTERNAL_URL` / `VITE_API_URL` with fallback
2. **Cookie forwarding** (lines 26-34 and lines 64-70): `getRequestHeader("cookie")` in try/catch
3. **Error extraction** (lines 37-44): `body?.error?.message ?? res.statusText` -- identical to `throwIfNotOk` in `fetch-utils.ts`

**Fix**: Extract a private `getServerBaseUrl()` and `forwardCookies()` helper within the file. The error extraction could import `throwIfNotOk` from `fetch-utils.ts`, but since `api-server.ts` runs server-side only, verify the import is safe in the SSR bundle first.

- **Implemented**: 2026-03-09

### P2-3: `buildMediaUrl` is a no-op identity function

**File**: `apps/web/src/lib/url.ts:3-8`

```typescript
export function buildMediaUrl(relativePath: string | null): string | null {
  if (!relativePath) return null;
  return relativePath;  // just returns the input unchanged
}
```

This function once prepended `API_BASE_URL` but now simply returns its argument. It's called from 7+ components (content-card, video-detail, audio-detail, creator-card, creator-header). The function and its 4 test cases add indirection with no benefit.

**Fix**: Inline the null-check at call sites (e.g. `item.thumbnailUrl ?? null` or just use the value directly), remove `buildMediaUrl`, and delete the test file. Alternatively, if future URL transformation is planned (e.g. CDN prefix, image optimization), keep the function as a documented "future hook" but add a comment explaining the current identity behavior.

- **Implemented**: 2026-03-09

### P2-4: `apiMutate` cannot handle void/204 responses

**File**: `apps/web/src/lib/fetch-utils.ts:67`

`apiMutate` unconditionally calls `response.json()`, which will throw on 204 No Content responses. This is why `cancelSubscription` (P1-1) had to bypass it. If more void-returning mutations are added, this will become a recurring pattern violation.

**Fix**: Add a guard: `if (response.status === 204) return undefined as T;` before the `json()` call. This enables `apiMutate<void>(...)` for endpoints that return no body.

- **Implemented**: 2026-03-09

### P2-5: Stale `web-fetch-client` pattern documentation

**File**: `.claude/skills/platform-patterns/web-fetch-client.md`

The pattern doc Example 1 shows `apiGet` constructing `new URL(\`\${API_BASE_URL}\${endpoint}\`)`, but the actual implementation no longer uses `API_BASE_URL` -- it builds a relative URL with `URLSearchParams`. The doc also doesn't mention `apiUpload` or the `signal` parameter on `apiGet`, both of which were added after the doc was written.

**Fix**: Update the pattern doc to match the current implementation. Add `apiUpload` to the examples. Document the `signal` parameter.

- **Implemented**: 2026-03-09

---

## P3 Nice-to-Have

### P3-1: Missing test coverage for 8 lib files

The following lib files have no dedicated test file:
- `fetch-utils.ts` -- core fetch infrastructure, tested only indirectly
- `subscription.ts` -- 5 functions, 0 direct tests
- `merch.ts` -- 3 functions, 0 direct tests
- `content.ts` -- 3 functions, 0 direct tests
- `admin.ts` -- 3 functions, 0 direct tests
- `emissions.ts` -- 2 functions, 0 direct tests
- `config.ts` -- 1 constant, 0 direct tests
- `form-utils.ts` -- 1 function, 0 direct tests

The API client modules (subscription, merch, content, admin, emissions) are thin wrappers over `apiGet`/`apiMutate`, so their risk is low. But `fetch-utils.ts` and `form-utils.ts` contain non-trivial logic that would benefit from direct unit tests.

**Priority**: `fetch-utils.ts` > `form-utils.ts` > API client modules > `config.ts`

- **Partially implemented**: 2026-03-09 — added tests for fetch-utils.ts and form-utils.ts (priority files from finding)

### P3-2: `offset-impact.ts` redundant ternary

**File**: `apps/web/src/lib/offset-impact.ts:30`

```typescript
value: `$${donation < 1 ? donation.toFixed(2) : donation.toFixed(2)}`,
```

Both branches of the ternary produce the same output. This is either a copy-paste leftover or a future placeholder.

**Fix**: Simplify to `value: \`$\${donation.toFixed(2)}\``.

- **Implemented**: 2026-03-09

### P3-3: `vite-env.d.ts` missing `VITE_DEMO_MODE`

**File**: `apps/web/src/vite-env.d.ts`

Only declares `VITE_API_URL` but `config.ts` reads `VITE_DEMO_MODE`. Adding it to the `ImportMetaEnv` interface would provide type safety.

**Fix**: Add `readonly VITE_DEMO_MODE?: string;` to `ImportMetaEnv`.

- **Implemented**: 2026-03-09

### P3-4: `auth.ts` `fetchAuthState` uses raw fetch instead of `apiGet`

**File**: `apps/web/src/lib/auth.ts:21-33`

`fetchAuthState()` uses raw `fetch("/api/me", ...)` instead of `apiGet`. Unlike P1-1, this is intentional -- the function has graceful degradation (returns `{ user: null, roles: [] }` on failure) rather than throwing, which `apiGet` would do. However, it could use `apiGet` in a try/catch for consistency.

**Fix**: Low priority. The current approach is valid since it needs to handle network failures gracefully for the auth state hook. Document the intentional divergence if desired.

- **Implemented**: 2026-03-09

---

## Skip (Intentional Patterns)

### S-1: Separate API client modules per domain

Files like `booking.ts`, `merch.ts`, `creator.ts`, `dashboard.ts`, `subscription.ts`, `content.ts`, `admin.ts`, and `emissions.ts` all follow the same structural pattern (import types from `@snc/shared`, import `apiGet`/`apiMutate` from `fetch-utils`, export thin wrapper functions). This looks like duplication but is intentional per the `web-fetch-client` pattern -- each domain gets its own file for independent evolution and clear import boundaries.

### S-2: `api-server.ts` vs `fetch-utils.ts` as parallel fetch layers

`fetch-utils.ts` handles client-side fetches (browser `fetch` with `credentials: "include"`). `api-server.ts` handles server-side fetches (TanStack `createServerFn` with cookie forwarding). These serve different execution contexts and should remain separate files despite similar error extraction logic.

### S-3: `co2-equivalencies.ts` and `offset-impact.ts` as separate modules

Both compute derived values from CO2 data but for different display purposes (EPA equivalencies vs Pika Project offset impact). They share no code and represent different business concepts.

### S-4: `navigateExternal` in `url.ts`

This trivial wrapper (`window.location.href = url`) enables testability -- tests can mock it without needing to mock `window.location`. Keeping it is appropriate.

---

## Best Practices Research

### TanStack Start / `createServerFn`

The current `api-server.ts` uses `createServerFn({ method: "GET" }).inputValidator(...)` which aligns with the documented API. The `.inputValidator()` method validates and passes through the input, which is used correctly here for the endpoint string.

One consideration: TanStack Start documentation recommends using route `loader` functions for data fetching (which the codebase already does) and notes that server functions can be combined with TanStack Query for caching and real-time updates. The current approach of `fetchApiServer` in loaders is correct.

### Better Auth

The `useSession` re-export from `authClient` is the recommended pattern. The `useRoles` hook fetches roles via a separate `/api/me` call because Better Auth's session doesn't include custom role data -- this is a valid approach. Better Auth docs suggest cookie caching for performance optimization, which could be evaluated for the session validation path.

### Zod 4 / zod-mini

The codebase correctly uses `zod/mini` in the web app (per CLAUDE.md conventions) and full `zod` in `@snc/shared`. The `extractFieldErrors` utility in `form-utils.ts` works with both since it only reads the generic `{ path, message }` issue shape. Zod 4 mini is ~10KB gzipped (half of Zod 3) and the codebase is already on v4.3.6.

### React 19

The `use()` hook is available for client-side data fetching as an alternative to `useEffect`-based patterns. The `useRoles` hook in `auth.ts` uses `useEffect` + `useCallback` for fetching -- this could potentially be simplified with `use()` and Suspense in the future, but the current approach works correctly.

---

## OSS Alternatives

### Fetch wrapper libraries (vs hand-rolled `fetch-utils.ts`)

| Package | Weekly Downloads | Size (gzip) | Last Publish | Notes |
|---------|-----------------|-------------|--------------|-------|
| [ky](https://github.com/sindresorhus/ky) | ~3M | ~3.5KB | Active (2026) | Retry, hooks, JSON by default, generic `.json<T>()` |
| [wretch](https://github.com/elbywan/wretch) | ~200K | ~2KB core | Active (2026) | Chainable API, addon system, middleware |

**Assessment**: The current `fetch-utils.ts` is 70 lines and handles the project's needs (credentials, query params, multipart upload, error extraction). Adopting `ky` or `wretch` would add a dependency for marginal benefit. The hand-rolled approach is justified here -- the API surface is small and stable. **Recommendation: keep current approach.**

### `Intl.RelativeTimeFormat` (vs hand-rolled `formatRelativeDate`)

The `formatRelativeDate` function in `format.ts` reimplements relative time formatting. `Intl.RelativeTimeFormat` is built into all modern browsers and Node.js 14+. However, the custom implementation provides specific formatting rules (e.g., `"3d ago"` compact format) that `Intl.RelativeTimeFormat` doesn't support in the `"short"` style without additional logic. **Recommendation: keep current approach** -- the custom format is intentional.

---

## Pattern Compliance

| Pattern | Status | Notes |
|---------|--------|-------|
| `web-fetch-client` | Compliant | Fixed: `cancelSubscription` now uses `apiMutate` (P1-1) |
| `web-fetch-client` (doc) | Compliant | Fixed: Doc updated with current implementation, `apiUpload`, `signal`, and `void` examples (P2-5) |
| Named exports only | Compliant | All 18 files use named exports |
| `node:` protocol for builtins | N/A | No Node.js builtins imported in lib |
| Import grouping | Compliant | All files follow the convention |
| camelCase functions | Compliant | |
| SCREAMING_SNAKE_CASE constants | Compliant | `DEMO_MODE`, `MONTHS`, `KG_PER_*`, etc. |
| kebab-case filenames | Compliant | All files use kebab-case |
| `zod/mini` in web app | Compliant | `form-utils.ts` works with generic issue shape |

---

## Suggested Implementation Order

1. **P1-1**: Fix `cancelSubscription` to use `apiMutate` (requires P2-4 first if endpoint returns 204)
2. **P2-4**: Add 204 handling to `apiMutate` (unblocks P1-1)
3. **P2-5**: Update `web-fetch-client` pattern doc to match current implementation
4. **P2-2**: Extract `getServerBaseUrl()` and `forwardCookies()` helpers in `api-server.ts`
5. **P2-3**: Remove or document `buildMediaUrl` identity function
6. **P2-1**: Consolidate `formatCo2` / `formatCo2Kg` into `format.ts`
7. **P3-2**: Fix redundant ternary in `offset-impact.ts`
8. **P3-3**: Add `VITE_DEMO_MODE` to `vite-env.d.ts`
9. **P3-1**: Add tests for `fetch-utils.ts` and `form-utils.ts`
10. **P3-4**: Optionally refactor `auth.ts` `fetchAuthState` to use `apiGet` with try/catch

---

## Research Sources

- [TanStack Start Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- [Better Auth Session Management](https://better-auth.com/docs/concepts/session-management)
- [Better Auth Performance Optimization](https://better-auth.com/docs/guides/optimizing-for-performance)
- [Zod v4 Release Notes](https://zod.dev/v4)
- [Zod v4 Mini Performance (InfoQ)](https://www.infoq.com/news/2025/08/zod-v4-available/)
- [ky - GitHub](https://github.com/sindresorhus/ky)
- [wretch - GitHub](https://github.com/elbywan/wretch)
