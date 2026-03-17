> **Archived**: 2026-03-09
> **Validation**: All tests passing, no cross-finding regressions

# Refactor Analysis: Booking Domain (Vertical Slice)

> **Generated**: 2026-03-09
> **Scope**: Full booking vertical slice — 22 files across shared schema, API (routes, schema, tests), web (lib, components, routes, tests), and cross-domain dashboard consumers
> **Libraries researched**: Hono v4.12, Drizzle ORM v0.45, Vitest v4, Zod v4.3, TanStack Start v1.162

---

## Executive Summary

The booking domain is well-structured with clean type continuity from shared Zod schemas through API transformers to web components. The vertical slice lens surfaced two findings that horizontal analysis could not: 4 of 5 functions in `lib/booking.ts` are dead surface (tested but never consumed by any UI component), and validation constants (`MAX_DATES`, `MAX_NOTES_LENGTH`) are locally defined instead of imported from `@snc/shared`. No P0 issues found. 6 findings total across P1–P3.

---

## P0 — Fix Now

None found.

---

## P1 — High Value

### 1. Dead API surface in `lib/booking.ts` — 4 of 5 functions unused

- **Affected files**: `apps/web/src/lib/booking.ts`, `apps/web/tests/unit/lib/booking.test.ts`
- **Current state**: The file exports 5 functions: `fetchServices`, `fetchServiceById`, `createBooking`, `fetchMyBookings`, `fetchBookingById`. Only `createBooking` is imported by any application code (`booking-form.tsx:7`). The other 4 are tested (67 test lines) but have zero consumers.
- **Why they're dead**:
  - `fetchServices` — `services.tsx` loader uses `fetchApiServer` (SSR server function), not client-side `apiGet`
  - `fetchServiceById` — no service detail page exists in the web app
  - `fetchMyBookings` — `settings/bookings.tsx` uses `useCursorPagination` with a raw URL callback, bypassing the lib function entirely
  - `fetchBookingById` — no booking detail page exists in the web app
- **Proposed consolidation**: Remove the 4 dead functions and their tests. If a service detail page or booking detail page is added later, re-add them then (YAGNI). Alternatively, keep `fetchMyBookings` if the settings/bookings page is refactored to use it — but that would require changing how `useCursorPagination` works.
- **Estimated scope**: 2 files changed, ~80 LOC removed
- **Pattern reference**: `web-fetch-client` — the pattern notes that `useCursorPagination` constructs its own URL via `buildUrl()`, making lib wrappers redundant for paginated endpoints
- **Tests affected**: `apps/web/tests/unit/lib/booking.test.ts` — remove 4 of 5 describe blocks (keep `createBooking`)
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P2 — Medium Value

### 2. Validation constants not imported from `@snc/shared`

- **Location**: `apps/web/src/components/booking/booking-form.tsx:14`, `packages/shared/src/booking.ts:41-42`
- **Affected files**: `packages/shared/src/booking.ts`, `apps/web/src/components/booking/booking-form.tsx`
- **Issue**: The server-side schema uses inline literals `.min(1).max(5)` for preferred dates and `.max(2000)` for notes. The client-side form defines `MAX_DATES = 5` locally and uses `maxLength(2000, ...)` inline. Per the `shared-validation-constants` pattern, these should be exported from `@snc/shared` so both sides import the same constants.
- **Suggestion**: Export `MAX_PREFERRED_DATES = 5` and `MAX_BOOKING_NOTES_LENGTH = 2000` from `packages/shared/src/booking.ts`. Import in both `CreateBookingRequestSchema` and `BOOKING_FORM_SCHEMA`.
- **Tests affected**: None — values don't change, only where they're defined
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 3. `useCursorPagination` drops structured error messages on HTTP errors

- **Location**: `apps/web/src/hooks/use-cursor-pagination.ts:48-49`
- **Affected files**: `apps/web/src/hooks/use-cursor-pagination.ts`, indirectly `settings/bookings.tsx` and `dashboard.tsx`
- **Issue**: When the API returns an error HTTP status, the hook sets `setError("Failed to load")` — a hardcoded generic message. The `catch` block (line 62) extracts error messages from exceptions, but the `!res.ok` branch (line 48) doesn't try to parse the structured `{ error: { message } }` body. This means users see "Failed to load" instead of specific messages like "Unauthorized" for session expiry.
- **Suggestion**: Extract the error message from the response body using the same logic as `throwIfNotOk` in `fetch-utils.ts`. Either import `throwIfNotOk` directly and let the catch block handle it, or inline the JSON body extraction.
- **Tests affected**: `apps/web/tests/unit/hooks/use-cursor-pagination.test.ts` — updated "sets error state when response is not ok" to verify structured message extraction; added new test for statusText fallback when body is not JSON
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P3 — Nice-to-Have

- **`getStatusClass` uses if/else chains** — `apps/web/src/components/booking/booking-list.tsx:16-20` — could use `Record<BookingStatus, string>` per `content-type-dispatch` pattern for exhaustive mapping
- **Dashboard fixture requester ID mismatch** — API `makeMockUserRow` uses `user_requester1`, web `makeMockPendingBookingItem` uses `user_requester_1` (extra underscore) — `apps/api/tests/helpers/booking-fixtures.ts:71` vs `apps/web/tests/helpers/dashboard-fixtures.ts:60`
- **Verbose fixture construction in BookingList tests** — `apps/web/tests/unit/components/booking-list.test.tsx:48` creates `makeMockBookingWithService().service` to get the default service, then overrides — could use `{ ...makeMockService(), name: "Mixing Session" }` directly
- **`reviewNote` not displayed in BookingList** — the API returns `reviewNote` and `reviewedBy` for reviewed bookings, but `BookingList` doesn't show them to the user — feature gap for future consideration

---

## Skip — Intentional Patterns

| Pattern | Location | Why it stays |
|---------|----------|-------------|
| `booking.status as BookingStatus` cast | `booking.routes.ts:84` | Known-safe Drizzle enum erasure; return type `BookingWithService` enforces correctness |
| `c.req.valid("query" as never) as MyBookingsQuery` | `booking.routes.ts:274,349` | Known hono-openapi limitation tracked upstream (#145, #192) |
| Date vs ISO string in dual-layer fixtures | API/web fixture files | Intentional per `dual-layer-fixtures` pattern — each layer matches its data format |
| Private transformers (`toServiceResponse`, etc.) not shared | `booking.routes.ts:60-107` | Correct per `row-to-response-transformer` pattern — each route file owns its transformers |
| `services.tsx` using `fetchApiServer` instead of `lib/booking.ts` | `services.tsx:16-19` | Correct per SSR loader pattern — loaders use server-side fetch with cookie forwarding |
| `useCursorPagination` `as` cast on JSON response | `use-cursor-pagination.ts:52` | Generic hook design; type parameter `T` provides the type safety |
| Web fixture inlines nested `service` in `makeMockBookingWithService` | `web/tests/helpers/booking-fixtures.ts:32` | Correct per `dual-layer-fixtures` — web fixtures may inline nested objects |

---

## Cross-Layer Continuity

### Schema-Transformer Alignment

| Shared Schema | Transformer | Status | Notes |
|---------------|-------------|--------|-------|
| `ServiceSchema` (8 fields) | `toServiceResponse` | **Aligned** | Return type `Service` — TS-enforced |
| `BookingWithServiceSchema` (11 fields) | `toBookingWithServiceResponse` | **Aligned** | Return type `BookingWithService` — TS-enforced; composes `toServiceResponse` |
| `PendingBookingItemSchema` (12 fields) | `toPendingBookingItemResponse` | **Aligned** | Return type `PendingBookingItem` — TS-enforced; composes `toBookingWithServiceResponse` |

### Validation Sync

| Field | Server Rule | Client Rule | Status |
|-------|-------------|-------------|--------|
| `preferredDates` | `z.array(z.string().min(1)).min(1).max(5)` | `z.array(z.string().check(minLength(1))).check(minLength(1), maxLength(5))` | **Synced** — same constraints, different syntax (Zod vs zod/mini) |
| `notes` | `z.string().max(2000).default("")` | `z.string().check(maxLength(2000))` | **Synced** — same max length |
| `MAX_DATES` constant | Inline `5` in schema | Local `const MAX_DATES = 5` | **Drift risk** — not imported from `@snc/shared` (Finding #2) |
| `MAX_NOTES` constant | Inline `2000` in schema | Inline `2000` in check | **Drift risk** — not shared (Finding #2) |
| `serviceId` | `z.string().min(1)` | (prop, not user input) | **N/A** — not editable by user |
| `ReviewBookingRequest.status` | `z.enum(["approved", "denied"])` | (programmatic, no form) | **N/A** — admin action, no client schema |

### Error Path Coverage

| Error | API Route | Web Consumer | UI Treatment |
|-------|-----------|--------------|--------------|
| `NotFoundError("Service not found")` | `booking.routes:181,222` | `BookingForm` (via `createBooking`) | Shows server error message in `role="alert"` |
| `NotFoundError("Booking not found")` | `booking.routes:433,487` | Dead surface / `dashboard.tsx` | Dashboard: shows review error. Booking detail: no consumer. |
| `ForbiddenError("Not the booking owner")` | `booking.routes:438` | Dead surface (`fetchBookingById` unused) | **No UI consumer** — finding #1 makes this moot |
| `ValidationError("Booking has already been reviewed")` | `booking.routes:492` | `dashboard.tsx` (via `reviewBooking`) | Shows review error in `role="alert"` |
| `ForbiddenError("Insufficient permissions")` | `booking.routes:327,455` | `useCursorPagination` | **Generic "Failed to load"** — finding #3 |
| `UnauthorizedError` | middleware | `beforeLoad` redirect | Auth redirect to `/login` |

### Type Chain

| Step | Type | Mechanism | Status |
|------|------|-----------|--------|
| Shared | `Service` / `BookingWithService` / `PendingBookingItem` | Zod `.infer` | Source of truth |
| DB Schema | `typeof services.$inferSelect` / `typeof bookingRequests.$inferSelect` | Drizzle `$inferSelect` | DB-level types |
| Transformer | `toServiceResponse` → `Service`, `toBookingWithServiceResponse` → `BookingWithService` | Explicit return type annotation | **TS-enforced** |
| Web lib | `apiGet<{ services: Service[] }>`, `apiMutate<{ booking: BookingWithService }>` | Generic parameter | Matches shared types |
| Component | `ServiceCardProps.service: Service`, `BookingListProps.bookings: BookingWithService[]` | Props interface | **Inferred from shared** |
| No `any` types | — | — | **Clean** |
| No manual re-definitions | — | — | **Clean** |

### Fixture Sync

| Entity | API Factory | Web Factory | Status | Notes |
|--------|-------------|-------------|--------|-------|
| Service | `makeMockService` | `makeMockService` | **Synced** | All 8 fields match; Date/string formats differ correctly |
| BookingRequest | `makeMockBookingRequest` | `makeMockBookingWithService` | **Synced** | All 10 fields match; web adds inline nested `service` |
| User (requester) | `makeMockUserRow` | `makeMockPendingBookingItem.requester` | **P3 mismatch** | ID `user_requester1` vs `user_requester_1` (Finding #3) |
| PendingBookingItem | `makeMockBookingWithUser` (composed) | `makeMockPendingBookingItem` (flat) | **Synced** | Different defaults for the scenario (pending vs general) |

### Dead API Surface

| Function | Defined In | Consumed By | Status |
|----------|-----------|-------------|--------|
| `fetchServices()` | `lib/booking.ts:15` | **None** (services page uses SSR `fetchApiServer`) | **Dead** |
| `fetchServiceById(id)` | `lib/booking.ts:23` | **None** (no service detail page) | **Dead** |
| `createBooking(data)` | `lib/booking.ts:34` | `BookingForm` component | **Live** |
| `fetchMyBookings(params)` | `lib/booking.ts:47` | **None** (settings page uses `useCursorPagination`) | **Dead** |
| `fetchBookingById(id)` | `lib/booking.ts:57` | **None** (no booking detail page) | **Dead** |
| `fetchPendingBookings(params)` | `lib/dashboard.ts:26` | **None** (dashboard uses `useCursorPagination`) | **Dead** |
| `reviewBooking(id, data)` | `lib/dashboard.ts:33` | `DashboardPage` component | **Live** |

Note: `fetchPendingBookings` in `lib/dashboard.ts` is also dead for the same reason — the dashboard page uses `useCursorPagination` directly.

---

## Best Practices Research

### Hono v4.12

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `describeRoute()` + `validator()` + `resolver()` from hono-openapi | Current approach is correct for hono-openapi integration | None needed |
| `as never` cast for `c.req.valid()` inside `describeRoute` | Tracked upstream (hono-openapi #145, #192); no better workaround available yet | Wait for upstream fix |

### Drizzle ORM v0.45

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `$inferSelect` for row types, manual chain mocking | Current approach is standard; Drizzle v0.45+ has improved type inference but no API changes affecting booking routes | None needed |
| `randomUUID()` for ID generation | Consider using Drizzle's `.$defaultFn(() => randomUUID())` in schema definition to centralize ID generation | Low |

### Vitest v4.0

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `vi.restoreAllMocks()` in `afterEach` | **Behavior changed in v4**: `restoreAllMocks()` now only restores `vi.spyOn()` mocks — it no longer resets `vi.fn()` or automocks. Use `vi.resetAllMocks()` alongside or instead. | Medium — 19 call sites project-wide, including `route-test-factory.ts` |
| `vi.hoisted()` + `vi.doMock()` patterns | Still recommended — not deprecated in v4 | None needed |
| Arrow-function constructor mocks | v4 requires `function`/`class` syntax for mocks called with `new` (arrow functions throw) | Low — check Stripe mock in `stripe.test.ts` (already uses `function`) |

> **Note**: The `vi.restoreAllMocks()` change is project-wide, not booking-specific. The booking route test uses `setupRouteTest` which calls `vi.restoreAllMocks()` in its `afterEach` — this works correctly because the factory also calls `vi.resetModules()` and `vi.clearAllMocks()` in `beforeEach`. However, a project-wide audit of all 19 call sites is recommended.

### Zod v4.3

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `z.iso.datetime()` for timestamp validation | Correct for Zod 4 — replaces the old `.datetime()` method | None needed |
| `zod/mini` with `.check()` in web | Correct — `zod/mini` is the recommended tree-shakeable import for frontend | None needed |

---

## OSS Alternatives

No candidates identified. The booking domain uses standard patterns (Hono routes, Drizzle queries, React components) with no hand-rolled infrastructure that a library would replace.

---

## Pattern Compliance

| Pattern | Status | Notes |
|---------|--------|-------|
| `row-to-response-transformer` | **Compliant** | 3 transformers, all with explicit shared return types |
| `route-private-helpers` | **Compliant** | Transformers, types, and constants are private to route file |
| `cursor-encode-decode` | **Compliant** | `buildPaginatedResponse` used for both paginated endpoints |
| `hono-typed-env` | **Compliant** | `Hono<AuthEnv>` on route, `as never` workaround documented |
| `drizzle-chainable-mock` | **Compliant** | SELECT/JOIN/DOUBLE JOIN/INSERT/UPDATE chains with `beforeEach` re-wiring |
| `hono-test-app-factory` | **Compliant** | Uses `setupRouteTest` factory (evolved form of the pattern) |
| `dual-layer-fixtures` | **Compliant** | API: Date objects + DB types; Web: ISO strings + shared types; defaults match |
| `shared-validation-constants` | **Fixed** | `MAX_PREFERRED_DATES` and `MAX_BOOKING_NOTES_LENGTH` now exported from `@snc/shared` (Finding #2) |
| `web-fetch-client` | **Compliant** | `apiGet`/`apiMutate` used correctly; dead functions are the issue, not the pattern |
| `css-modules-design-tokens` | **Compliant** | All 3 CSS modules use `var(--token)` throughout; no hardcoded values |
| `listing-page-shared-css` | **Compliant** | Both listing pages import from `listing-page.module.css` |
| `vi-hoisted-module-mock` | **Compliant** | BookingForm, BookingList, PendingBookingsTable tests all follow hoisting pattern |
| `app-error-hierarchy` | **Compliant** | Uses `NotFoundError`, `ForbiddenError`, `ValidationError` — never plain `Error` |
| `content-type-dispatch` | **Minor drift** | `getStatusClass` uses if/else instead of Record lookup (P3) |

---

## Suggested Implementation Order

1. **Finding #1 (P1)** — Remove dead functions from `lib/booking.ts` and their tests. Also remove `fetchPendingBookings` from `lib/dashboard.ts`. Zero risk — no consumers to break.
2. **Finding #2 (P2)** — Export `MAX_PREFERRED_DATES` and `MAX_BOOKING_NOTES_LENGTH` from `@snc/shared/booking.ts`. Import in both server schema and client form.
3. **Finding #3 (P2)** — Improve `useCursorPagination` error extraction to parse structured API error messages instead of hardcoding "Failed to load".
4. **P3 items** — Address opportunistically when touching the affected files.

Order by: zero-risk dead code removal first → shared constant extraction → cross-cutting hook improvement.
