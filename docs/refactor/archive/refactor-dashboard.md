> **Archived**: 2026-03-09
> **Validation**: All tests passing, no cross-finding regressions

# Refactor Analysis: Dashboard Domain (Vertical Slice)

> **Generated**: 2026-03-09
> **Scope**: 18 files — shared schema, API routes, API service, web lib, web route, 3 components, 5 CSS modules, 2 API test files, 2 web test files, 2 fixture files
> **Libraries researched**: Hono v4.12, Drizzle ORM v0.45, Vitest v4.0, Stripe SDK v20.4, React 19.2, TanStack Start v1.162

---

## Executive Summary

The dashboard vertical slice is structurally sound and follows most established patterns. The analysis found **0 P0**, **2 P1**, **4 P2**, and **5 P3** findings. The highest-impact opportunities are: (1) extracting the duplicated `.error`, `.loadMoreWrapper`, `.loadMoreButton`, and `.status` CSS from `dashboard.module.css` into the existing shared `listing-page.module.css` / a new shared `error-alert.module.css`, and (2) adding a missing `503` OpenAPI response spec on the `/revenue` endpoint alongside a missing test for the `ensureConfigured` failure path in the revenue service.

---

## P0 — Fix Now

None found.

---

## P1 — High Value

### 1. Missing 503 OpenAPI response + untested `ensureConfigured` failure path in revenue

- **Affected files**: `apps/api/src/routes/dashboard.routes.ts:26-60`, `apps/api/tests/services/revenue.test.ts`, `apps/api/tests/routes/dashboard.routes.test.ts`
- **Current state**: The `getMonthlyRevenue` service calls `ensureConfigured()` from `stripe-client.ts`, which returns `err(AppError("BILLING_NOT_CONFIGURED", ..., 503))` when `STRIPE_SECRET_KEY` is null. The `/revenue` route throws `result.error` for any failure, so a 503 *can* be returned at runtime. However:
  - The OpenAPI spec for `GET /dashboard/revenue` documents `502` but not `503`.
  - The revenue service test always mocks `ensureConfigured` as `{ ok: true }` — the 503 path is never exercised.
  - The dashboard route test has no 503 test case.
  - The subscription routes (`subscription.routes.ts:169`, `subscription.routes.ts:241`) correctly declare `503: ERROR_503` for the same underlying Stripe path.
- **Risk**: Inconsistent API documentation; untested failure path that real deployments without Stripe keys will hit.
- **Proposed fix**:
  1. Add `ERROR_503` import and `503: ERROR_503` to the revenue endpoint's `responses` block.
  2. Add a test in `revenue.test.ts` that mocks `ensureConfigured` returning `err(...)` and asserts the Result is `{ ok: false, error.code: "BILLING_NOT_CONFIGURED", error.statusCode: 503 }`.
  3. Add a test in `dashboard.routes.test.ts` that mocks `getMonthlyRevenue` returning the 503 error and asserts `res.status === 503`.
- **Estimated scope**: 3 files, ~25 LOC added
- **Pattern reference**: `stripe-service-layer`, `result-type`
- **Tests affected**: `apps/api/tests/services/revenue.test.ts`, `apps/api/tests/routes/dashboard.routes.test.ts`
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 2. CSS duplication — dashboard.module.css duplicates shared listing-page.module.css and settings-page.module.css

- **Affected files**: `apps/web/src/routes/dashboard.module.css`, `apps/web/src/styles/listing-page.module.css`, `apps/web/src/styles/settings-page.module.css`
- **Current state**: `dashboard.module.css` contains four CSS blocks that are identical or near-identical to shared styles:
  - `.loadMoreWrapper` (lines 59-63) — identical to `listing-page.module.css:18-22`
  - `.loadMoreButton` + `:hover` + `:disabled` (lines 65-85) — identical to `listing-page.module.css:24-44`
  - `.status` (lines 89-94) — identical to `listing-page.module.css:9-14`
  - `.error` (lines 48-55) — identical to `settings-page.module.css:10-17`; also duplicated in `pricing.module.css`, `services.module.css`, `admin.module.css`, `emissions.module.css`
- **Proposed consolidation**:
  1. Import `listing-page.module.css` in `dashboard.tsx` for `.loadMoreWrapper`, `.loadMoreButton`, `.status` (same pattern other listing pages use).
  2. Extract the `.error` block into a new shared `apps/web/src/styles/error-alert.module.css`, imported by all 6+ pages that duplicate it.
  3. Remove the duplicated blocks from `dashboard.module.css`.
- **Estimated scope**: 7+ CSS files changed, ~60 LOC removed, 1 new shared CSS file (~6 LOC)
- **Pattern reference**: `listing-page-shared-css`, `css-modules-design-tokens`
- **Tests affected**: None (CSS-only)
- **Verify**: [x] Visual regression check / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P2 — Medium Value

### 3. Stale CLAUDE.md and web-fetch-client pattern doc reference `fetchPendingBookings`

- **Location**: `CLAUDE.md:167`, `.claude/skills/platform-patterns/web-fetch-client.md:82-87`
- **Affected files**: `CLAUDE.md`, `.claude/skills/platform-patterns/web-fetch-client.md`
- **Issue**: `fetchPendingBookings` was identified as dead in the booking refactor (see `docs/refactor/archive/refactor-booking.md:153`) and has been removed from `apps/web/src/lib/dashboard.ts`. However, two documentation files still reference it:
  - `CLAUDE.md` line 167 lists it as a dashboard.ts export.
  - `web-fetch-client.md` lines 82-87 use it as an example of `apiGet` usage.
- **Suggestion**: Remove the `fetchPendingBookings` reference from `CLAUDE.md` and replace the example in `web-fetch-client.md` with the actual `fetchBookingSummary` function or another live function.
- **Tests affected**: None
- **Verify**: [x] Docs accurate / [x] No code changes
- **Implemented**: 2026-03-09

### 4. Dashboard route `useEffect` data-fetching pattern — consider TanStack loader

- **Location**: `apps/web/src/routes/dashboard.tsx:80-118`
- **Affected files**: `apps/web/src/routes/dashboard.tsx`
- **Issue**: The dashboard page fetches KPI data via a `useEffect` in the component body. This deviates from the project-wide `tanstack-file-route` pattern, which prescribes using `loader` for data fetching and `Route.useLoaderData()` for access. Other pages (pricing, creators, services, feed) use this pattern. The `useEffect` approach causes:
  - A client-side loading state (flash of loading spinners) on every page visit.
  - No server-side data fetching (all 4 KPI calls happen client-side).
  - The `cancelled` flag anti-pattern that a loader would eliminate.
- **Suggestion**: Move the `fetchRevenue`, `fetchSubscribers`, `fetchBookingSummary`, and `fetchEmissionsSummary` calls into a `loader` function, returning the data via `Route.useLoaderData()`. The pending bookings pagination can remain client-side via `useCursorPagination` (that pattern is appropriate for paginated data).
- **Tests affected**: `apps/web/tests/unit/routes/dashboard.test.tsx` (would need loader mocking)
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 5. Missing `beforeLoad` guard tests for dashboard route

- **Location**: `apps/web/tests/unit/routes/dashboard.test.tsx`
- **Affected files**: `apps/web/tests/unit/routes/dashboard.test.tsx`
- **Issue**: The dashboard route has a `beforeLoad` guard that redirects unauthenticated users to `/login` and non-cooperative-members to `/feed`. The test file mocks `fetchAuthStateServer` but never exercises these redirect branches. Per CLAUDE.md coding conventions: "Every Hono route must have at least one happy-path test and one auth/validation failure test." The same principle applies to route guards.
- **Suggestion**: Add two tests:
  1. `it("redirects to /login when user is not authenticated")` — mock `fetchAuthStateServer` returning `{ user: null, roles: [] }`.
  2. `it("redirects to /feed when user lacks cooperative-member role")` — mock returning `{ user: { id: "u1" }, roles: ["subscriber"] }`.
  Use the `extractRoute` helper (from `route-test-utils.ts`) to access `beforeLoad` and assert `redirect()` is called with the correct target.
- **Tests affected**: `apps/web/tests/unit/routes/dashboard.test.tsx`
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 6. Revenue service test does not cover the `ensureConfigured` failure path

- **Location**: `apps/api/tests/services/revenue.test.ts`
- **Affected files**: `apps/api/tests/services/revenue.test.ts`
- **Issue**: All revenue service tests mock `ensureConfigured` as `{ ok: true }`. The stripe.test.ts file has a dedicated `setupStripeServiceUnconfigured` factory and tests the 503 path — the revenue test should follow the same pattern for consistency and coverage.
- **Suggestion**: Add a test using a `setupRevenueServiceUnconfigured` factory (mirroring `setupStripeServiceUnconfigured` in stripe.test.ts) that asserts `getMonthlyRevenue` returns `{ ok: false, error.code: "BILLING_NOT_CONFIGURED", error.statusCode: 503 }`.
- **Tests affected**: `apps/api/tests/services/revenue.test.ts`
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P3 — Nice-to-Have

- **`dashboard.module.css:9-13`** — `.heading` is identical to `listing-page.module.css:1-5`; could import from shared. Low priority since it's only 4 lines.
- **`apps/api/tests/routes/dashboard.routes.test.ts:99-103`** — Revenue test computes dynamic `currentMonth`/`currentYear` from `new Date()` without fake timers. While the test works because it matches the route handler's same calculation, using `vi.useFakeTimers()` would make it deterministic per the `fake-timers-deterministic-testing` pattern.
- **`apps/web/src/components/dashboard/revenue-chart.tsx:14`** — `MAX_BAR_HEIGHT = 200` magic number matches `.barRow { height: 200px }` in the CSS. Consider extracting as a CSS custom property `--chart-bar-height: 200px` and referencing in JS via `getComputedStyle` or just documenting the coupling with a comment.
- **`apps/web/src/components/dashboard/pending-bookings-table.tsx:18-27`** — `formatPreferredDates` is a pure utility inlined as a private function. If booking date formatting is needed elsewhere, consider moving to `lib/format.ts`. Currently single-use, so this is opportunistic.
- **`apps/web/src/routes/dashboard.tsx:70-76`** — `removedIds` + `pendingAdjustment` state management for optimistic booking removal is bespoke. Consider `useOptimistic` from React 19 for a more idiomatic approach. Low priority — current implementation works correctly.

---

## Skip — Intentional Patterns

| Pattern | Location | Why it stays |
|---------|----------|-------------|
| Dual-layer fixtures (API uses `Date`, web uses ISO strings) | `api/tests/helpers/dashboard-fixtures.ts` vs `web/tests/helpers/dashboard-fixtures.ts` | Per `dual-layer-fixtures` pattern — API fixtures match Drizzle `$inferSelect`, web fixtures match JSON response shapes |
| `useCursorPagination` for pending bookings instead of `fetchPendingBookings` lib function | `dashboard.tsx:53-67` | Per `use-cursor-pagination` pattern — the hook manages its own fetch lifecycle; a lib wrapper would be dead code (confirmed by booking refactor archive) |
| Separate `.module.css` per component (kpi-card, revenue-chart, pending-bookings-table) | `components/dashboard/` | Per `css-modules-design-tokens` pattern — each component owns its styles |
| `reviewBooking` in `lib/dashboard.ts` not in `lib/booking.ts` | `apps/web/src/lib/dashboard.ts:25-34` | The review action is a dashboard-only mutation used by the dashboard page's `handleReview` callback. Placing it in the dashboard lib module follows the vertical-slice ownership principle. |
| No DB schema file for dashboard | N/A | Dashboard queries existing `userSubscriptions` and `bookingRequests` tables — no dashboard-specific tables needed |

---

## Best Practices Research

### Hono v4.12

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `app.onError(errorHandler)` with `AppError` hierarchy | Matches Hono best practices; `onError` is correct for catching route handler throws | None needed |
| `describeRoute()` + `resolver()` for OpenAPI | Current approach is correct for hono-openapi integration | None needed |

### Drizzle ORM v0.45

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `db.select({ count: count() }).from(table).where(...)` | Matches official Drizzle count pattern | None needed |
| `Promise.all` for parallel count queries in bookings endpoint | Recommended practice for parallel independent queries | None needed |

### Vitest v4.0

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `vi.useFakeTimers()` + `vi.setSystemTime()` with explicit `vi.useRealTimers()` | Matches best practice; always restore timers | None needed |
| `vi.doMock` + dynamic import for service tests | Correct pattern for eagerly-initialized singletons | None needed |
| `setupRouteTest` factory for API route tests | Excellent consolidation of common boilerplate | None needed |

### Stripe SDK v20.4

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| Auto-pagination via `for await` on `invoices.list()` | Correct — SDK handles pagination automatically | None needed |
| `wrapExternalError` factory for 502 wrapping | Clean pattern; matches Stripe error isolation guidance | None needed |

### React 19.2

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `useEffect` for KPI data fetching | React 19 and TanStack Start recommend `loader` / `use()` / server actions over `useEffect` for data fetching | Medium — see Finding #4 |
| `useCallback` for review handler | Appropriate for event callbacks | None needed |
| `useState` + manual `removedIds` for optimistic UI | React 19 `useOptimistic` is more idiomatic | Low — see P3 note |

---

## OSS Alternatives

No candidates identified. The dashboard uses standard Stripe SDK, Drizzle count queries, and React state management — no hand-rolled code warrants a library replacement.

---

## Pattern Compliance

| Pattern | Status | Notes |
|---------|--------|-------|
| `stripe-service-layer` | **Compliant** | Revenue service uses `Result<T, AppError>`, `wrapExternalError`, `ensureConfigured` |
| `external-error-factory` | **Compliant** | `wrapRevenueError = wrapExternalError("REVENUE_ERROR")` |
| `result-type` | **Compliant** | All service returns use `ok()`/`err()` |
| `app-error-hierarchy` | **Compliant** | `REVENUE_ERROR` (502), `BILLING_NOT_CONFIGURED` (503) |
| `hono-typed-env` | **Compliant** | `Hono<AuthEnv>` used on `dashboardRoutes` |
| `web-fetch-client` | **Compliant** | `apiGet` and `apiMutate` used in `lib/dashboard.ts` |
| `css-modules-design-tokens` | **Compliant** | All CSS uses `var(--token)` references |
| `listing-page-shared-css` | **Fixed** | Dashboard now imports from shared `listing-page.module.css` (Finding #2) |
| `vi-hoisted-module-mock` | **Compliant** | Dashboard test uses `vi.hoisted()` correctly |
| `dual-layer-fixtures` | **Compliant** | API and web fixtures use correct shapes |
| `fake-timers-deterministic-testing` | **Compliant** in revenue.test.ts | Minor drift in dashboard.routes.test.ts (Finding P3, see above) |
| `hono-test-app-factory` | **Compliant** | Uses `setupRouteTest` factory |
| `tanstack-file-route` | **Compliant** | Dashboard uses `loader` + `Route.useLoaderData()` for KPI data fetching (Finding #4 implemented) |

---

## Cross-Layer Continuity

### Schema-Transformer Alignment

| Shared Schema | Transformer | Status | Notes |
|---------------|-------------|--------|-------|
| `RevenueResponseSchema` (2 fields: `currentMonth`, `monthly`) | Inline in route handler (line 58) | **Compliant** | No transformer needed — response is built directly from service result |
| `SubscriberSummarySchema` (1 field: `active`) | Inline in route handler (line 86) | **Compliant** | Direct DB count mapped to response |
| `BookingSummarySchema` (2 fields: `pending`, `total`) | Inline in route handler (lines 117-120) | **Compliant** | Direct DB counts mapped to response |

Note: Dashboard routes return simple aggregate values (counts, sums) rather than entity rows. No row-to-response transformer is needed because there are no Date-to-ISO or key-to-URL conversions.

### Validation Sync

| Field | Server Rule | Client Rule | Status |
|-------|-------------|-------------|--------|
| N/A | N/A | N/A | **N/A** — Dashboard endpoints are read-only (GET only). No client-side input validation exists because there are no forms. The `ReviewBookingRequest` used by the dashboard is validated on the booking route, not the dashboard route. |

### Error Path Coverage

| Error | API Route | Web Component | UI Treatment |
|-------|-----------|---------------|--------------|
| 401 Unauthenticated | `requireAuth` middleware | `beforeLoad` redirect | Redirect to `/login` — never reaches component |
| 403 Forbidden | `requireRole("cooperative-member")` | `beforeLoad` redirect | Redirect to `/feed` — never reaches component |
| 502 REVENUE_ERROR | `throw result.error` in revenue handler | `catch` in `loadKpis` useEffect | `role="alert"` error banner with message |
| 503 BILLING_NOT_CONFIGURED | `throw result.error` (from `ensureConfigured`) | `catch` in `loadKpis` useEffect | `role="alert"` error banner — **but OpenAPI spec missing 503** (Finding #1) |
| Network error (bookings fetch) | N/A (client-side) | `useCursorPagination` error state | `role="alert"` error banner |
| Review failure | `throw` in booking route | `catch` in `handleReview` | `role="alert"` error banner with message |

### Type Chain

| Step | Type | Mechanism | Status |
|------|------|-----------|--------|
| Shared schema | `RevenueResponse`, `SubscriberSummary`, `BookingSummary` | Zod `z.infer<>` | **Compliant** |
| API route return | `c.json({ currentMonth, monthly })` | Matches `RevenueResponseSchema` shape | **Compliant** (no explicit type annotation — shape matches) |
| Web lib | `apiGet<RevenueResponse>("/api/dashboard/revenue")` | Generic param references shared type | **Compliant** |
| Web component | `useState<RevenueResponse \| null>` | Shared type imported | **Compliant** |
| Pending bookings | `useCursorPagination<PendingBookingItem>` | Generic param references shared type | **Compliant** |
| Review request | `apiMutate<{ booking: BookingWithService }>` | Shared types | **Compliant** |

No `as` casts, no `any` types, no manual re-definitions found in the type chain.

### Fixture Sync

| Entity | API Factory | Web Factory | Status | Notes |
|--------|-------------|-------------|--------|-------|
| MonthlyRevenue | `makeMockMonthlyRevenue` (month: 1, year: 2026, amount: 5000) | `makeMockMonthlyRevenue` (month: 2, year: 2026, amount: 5000) | **P3 mismatch** | Default `month` differs (1 vs 2). Not a bug — both valid — but divergent defaults make cross-layer debugging harder. |
| StripeInvoice | `makeMockStripeInvoice` (API only) | N/A | **Compliant** | Stripe shapes are API-only; web layer never sees raw invoices |
| RevenueResponse | N/A | `makeMockRevenueResponse` (web only) | **Compliant** | API tests use the revenue service mock, not a fixture for the full response |
| SubscriberSummary | N/A | `makeMockSubscriberSummary` | **Compliant** | API tests use inline `{ count: N }` rows |
| BookingSummary | N/A | `makeMockBookingSummary` | **Compliant** | API tests use inline `{ count: N }` rows |
| PendingBookingItem | N/A | `makeMockPendingBookingItem` | **Compliant** | All required fields present, matches `PendingBookingItemSchema` |

---

## Suggested Implementation Order

1. **Finding #1 (P1)** — Add `503: ERROR_503` to revenue route OpenAPI spec + add `ensureConfigured` failure tests in both revenue service and dashboard route tests. Zero risk, improves API documentation accuracy and test coverage.
2. **Finding #2 (P1)** — Extract duplicated CSS into shared modules. Mechanical change, no behavioral impact, reduces ~60 LOC of duplication across 7+ files.
3. **Finding #3 (P2)** — Fix stale documentation references to `fetchPendingBookings`. Quick doc edit.
4. **Finding #5 (P2)** — Add `beforeLoad` guard tests. Improves test coverage for auth/role redirects.
5. **Finding #6 (P2)** — Add revenue service unconfigured test. Mirrors existing stripe.test.ts pattern.
6. **Finding #4 (P2)** — Migrate KPI fetching to TanStack `loader`. Medium effort but aligns with project-wide data-fetching convention. Can be deferred.

Order rationale: Dependencies first (Finding #1 and #6 are related), then highest value, then least risk.
