> **ARCHIVED** — All findings implemented and verified. Archived 2026-03-07.
> Test results at archive time: API 411 passed, Web 675 passed, Shared 401 passed (1,487 total, 0 failures).

# Refactor Report: Tests

**Scope:** All test files across `apps/api/tests/`, `apps/web/tests/`, `packages/shared/tests/`
**Date:** 2026-03-06
**Status:** Complete -- all findings implemented and verified

---

## Inventory

| Package | Test files | Helpers | Total tests (approx) |
|---------|-----------|---------|---------------------|
| `apps/api/tests/` | 25 | 10 | 344 |
| `apps/web/tests/` | 71 | 10 | 567 |
| `packages/shared/tests/` | 11 | 0 | 387 |
| **Total** | **107** | **20** | **1,298** |

---

## Findings

### F1 -- TanStack Router mock duplicated across 31 web test files

**Priority:** P0
**Category:** Duplication
**Impact:** ~620 lines of near-identical boilerplate

Every web component and route test file independently defines a `vi.mock("@tanstack/react-router", ...)` block that creates a fake `Link` component, `useNavigate`, `createFileRoute`, and/or `useSearch`. These differ only in which route params they handle (`$contentId`, `$creatorId`, `$handle`) and which exports they provide.

**Affected files:** 31 files in `apps/web/tests/unit/`

**Recommendation:** Extract a shared `mockTanStackRouter` factory into `apps/web/tests/helpers/router-mock.ts` that:
- Exports a generic `Link` stub with regex-based param replacement (already used in some files)
- Exports `mockNavigate`, `mockUseSearch`, `mockUseLoaderData` as hoisted fns
- Provides a `setupRouterMock(options?)` function for `vi.mock()` factories
- Each test file reduces to 1-2 lines: import the helper, call `vi.mock(...)` with it

**Estimated savings:** ~500 lines removed, single point of maintenance for router mock shape changes.

- **Implemented**: 2026-03-06

---

### F2 -- Auth mock (`useSession`, `useRoles`, `hasRole`) duplicated across 13 web test files

**Priority:** P0
**Category:** Duplication
**Impact:** ~260 lines of identical mock setup

Files mocking `../../../src/lib/auth.js` all define the same shape: `{ useSession: mockUseSession, useRoles: mockUseRoles, hasRole: (roles, role) => roles.includes(role) }`. The `hasRole` implementation is literally identical in every file.

**Affected files:** nav-bar, user-menu, subscribe-cta, creator-header, hero-section, landing-pricing, pricing, creator-detail, services, settings-creator, emissions, use-guest-redirect, use-subscriptions

**Recommendation:** Extract to `apps/web/tests/helpers/auth-mock.ts`:
- Export `mockUseSession`, `mockUseRoles` as hoisted fns
- Export `createAuthMockFactory()` for use in `vi.mock()` second arg
- Each test file reduces to: `vi.mock("*/lib/auth.js", createAuthMockFactory())`

**Estimated savings:** ~200 lines removed.

- **Implemented**: 2026-03-06

---

### F3 -- Format mock duplicated across 13 web test files

**Priority:** P1
**Category:** Duplication
**Impact:** ~130 lines of repeated mock setup

Files mocking `../../../src/lib/format.js` use various subsets of `formatDate`, `formatRelativeDate`, `formatPrice`, `formatCo2`, `formatInterval`, `formatIntervalShort`. Some use `vi-import-original-partial-mock` pattern (good), others mock the entire module.

**Affected files:** content-card, video-detail, audio-detail, written-detail, subscription-list, booking-list, product-card, product-detail, pending-bookings-table, feed, merch, creator-detail, emissions

**Recommendation:** Extract to `apps/web/tests/helpers/format-mock.ts`:
- Export individual mock fns: `mockFormatPrice`, `mockFormatRelativeDate`, etc.
- Export `createFormatMockFactory(overrides?)` for flexible partial mocking
- Provide default implementations (e.g., `formatPrice: (cents) => \`$${(cents/100).toFixed(2)}\``)

**Estimated savings:** ~100 lines removed, consistent formatting in test output.

- **Implemented**: 2026-03-06

---

### F4 -- API route test `vi.doMock` boilerplate (config + db + middleware + storage)

**Priority:** P0
**Category:** Duplication
**Impact:** ~1,100 lines across 11 route test files

Every API route test file has a nearly identical `beforeEach` block that `vi.doMock`s 4-7 modules: config, db/connection, middleware/require-auth, middleware/require-role, storage, and domain-specific services. The config mock alone appears in 16 files. Each route test also duplicates the app assembly pattern: `new Hono().onError(errorHandler).use(corsMiddleware).route(...)`.

**Affected files:** All 11 files in `apps/api/tests/routes/` (auth, me, content, creator, subscription, webhook, merch, booking, dashboard, admin, emissions) plus 4 service tests

**Breakdown of vi.doMock calls:** 57 total across 11 route files (avg 5.2 per file)

**Recommendation:** Create `apps/api/tests/helpers/route-test-factory.ts`:
```
export function createRouteTestContext(options: {
  mocks?: { db?: ..., storage?: ..., auth?: ... },
  routes: (app: Hono) => void,
}) => { app, mocks, cleanup }
```
- Encapsulates `vi.doMock` for config, db, auth middleware, error handler
- Returns typed mock references for per-test customization
- Reduces each route test's setup from ~40-60 lines to ~10 lines

**Estimated savings:** ~700 lines removed, eliminates the most error-prone copy-paste pattern in the codebase.

- **Implemented**: 2026-03-06

---

### F5 -- `beforeAll` + dynamic import pattern for route component extraction (16 web route tests)

**Priority:** P1
**Category:** Duplication
**Impact:** ~96 lines of identical boilerplate

Every web route test uses this exact pattern:
```tsx
let PageComponent: () => React.ReactElement;
beforeAll(async () => {
  const mod = await import("../../../src/routes/some-route.js");
  PageComponent = (mod.Route as unknown as { component: () => React.ReactElement }).component;
});
```

The `as unknown as { component }` cast is duplicated in every file.

**Affected files:** 16 route test files in `apps/web/tests/unit/routes/`

**Recommendation:** Extract to `apps/web/tests/helpers/route-test-utils.ts`:
```ts
export function extractRouteComponent<T>(importFn: () => Promise<{ Route: unknown }>): () => T
```
Each test reduces to: `const Page = extractRouteComponent(() => import("..."));`

**Estimated savings:** ~65 lines, eliminates unsafe `as unknown as` cast from 16 files.

- **Implemented**: 2026-03-06

---

### F6 -- SubscribeCta mock duplicated in 3 content detail tests

**Priority:** P2
**Category:** Duplication
**Impact:** ~30 lines

`video-detail.test.tsx`, `audio-detail.test.tsx`, and `written-detail.test.tsx` each independently mock SubscribeCta as a null-rendering stub with identical code.

**Affected files:** video-detail, audio-detail, written-detail

**Recommendation:** Extract to `apps/web/tests/helpers/component-stubs.ts`:
- Export `nullComponentMock(name)` factory for common null-render stubs
- Reusable for SubscribeCta, VideoPlayer, AudioPlayer, MiniPlayer stubs

**Estimated savings:** ~20 lines, plus establishes the pattern for future stubs.

- **Implemented**: 2026-03-06

---

### F7 -- hero-section and landing-pricing have near-identical mock setup (~50 lines each)

**Priority:** P1
**Category:** Duplication
**Impact:** ~50 lines of duplicated mock blocks

Both files mock router, auth, subscription, and url modules with the same shapes. They share the same `mockCreateCheckout`, `mockUseSession`, `mockFetchPlans` mock fns.

**Affected files:** `hero-section.test.tsx`, `landing-pricing.test.tsx`

**Recommendation:** Extract shared landing test setup to a helper or combine the shared mocks with the auth-mock (F2) and router-mock (F1) helpers. Once F1 and F2 are implemented, these files will naturally deduplicate.

**Estimated savings:** ~50 lines (largely covered by F1 + F2 implementation).

---

### F8 -- `as any` casts in test files

**Priority:** P2
**Category:** Pattern compliance
**Impact:** 23 occurrences across 10 files

The coding conventions require `strict: true` and discourage type escape hatches. Most `as any` casts occur in API route/service tests (emissions routes has 9 alone) and 1 in `storage-factory.test.ts`.

**Affected files (API):** content.routes (3), admin.routes (3), emissions.routes (9), subscription.routes (1), dashboard.routes (1), creator.routes (1), booking.routes (1), require-role (2), storage-factory (1)
**Affected files (Web):** settings-creator (1)

**Recommendation:** Replace with proper typed mocks or `satisfies`/`as Partial<T>` patterns. For Drizzle mocks, create typed mock factories that return the correct shapes. The emissions routes file is the worst offender and should be prioritized.

**Estimated savings:** Improved type safety, eliminates 23 type escape hatches.

- **Implemented**: 2026-03-07

---

### F9 -- `document.querySelector` used instead of testing-library queries (9 web test files)

**Priority:** P2
**Category:** Pattern compliance
**Impact:** 22 occurrences across 9 files

Testing Library best practice is to use `screen.getByRole`, `screen.getByTestId`, etc. instead of raw DOM queries. Most occurrences are in audio/video player tests where `document.querySelector("audio")` is used to access the underlying `<audio>` element.

**Affected files:** video-player (7), audio-player-context (8), mini-player (1), audio-player (1), user-menu (1), social-links-section (1), revenue-chart (1), pending-bookings-table (1), emissions-chart (1)

**Recommendation:** For audio/video elements, `document.querySelector` is acceptable since there's no semantic role for the underlying media element in jsdom. Mark these as **Skip** for the audio/video cases. For the remaining cases (user-menu, social-links-section), refactor to use testing-library queries where possible.

**Adjusted priority:** Skip for audio/video (15 occurrences), P2 for the remaining 7.

---

### F10 -- `vi.stubGlobal("fetch")` boilerplate in web lib tests

**Priority:** P2
**Category:** Duplication
**Impact:** ~60 lines across 4 lib test files

`booking.test.ts`, `creator.test.ts`, `dashboard.test.ts`, and `auth.test.ts` each set up the same `mockFetch` pattern in `beforeEach`:
```ts
let mockFetch: ReturnType<typeof vi.fn>;
beforeEach(() => { mockFetch = vi.fn(); vi.stubGlobal("fetch", mockFetch); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
```

**Recommendation:** Extract to `apps/web/tests/helpers/fetch-mock.ts`:
```ts
export function setupFetchMock() { /* returns mockFetch, handles lifecycle */ }
```
This could also be extended to handle the common Response construction patterns.

**Estimated savings:** ~40 lines, plus consistent fetch mock lifecycle.

- **Implemented**: 2026-03-07

---

### F11 -- Fake timers setup/teardown repeated inconsistently

**Priority:** P2
**Category:** Pattern compliance
**Impact:** Minor but affects test reliability

`format.test.ts` calls `vi.useFakeTimers()` + `vi.setSystemTime()` inside each individual test, then `vi.useRealTimers()` in `afterEach`. The `fake-timers-deterministic-testing` pattern recommends setting up timers in `beforeEach` and restoring in `afterEach`. Other files (checkout-success, dashboard) follow the pattern correctly.

**Affected files:** `format.test.ts` (7 tests with individual timer setup)

**Recommendation:** Move `vi.useFakeTimers()` + `vi.setSystemTime(NOW)` to `beforeEach`, keep `vi.useRealTimers()` in `afterEach`. Reduces per-test boilerplate by 2 lines each (14 lines total).

**Estimated savings:** 14 lines, consistency with established pattern.

- **Implemented**: 2026-03-07

---

### F12 -- api-server.test.ts uses fragile index-based handler capture

**Priority:** P1
**Category:** Complexity / Fragility
**Impact:** Single file but high brittleness

The `createServerFn` mock uses a `callIndex++` counter and `SERVER_FN_NAMES` array to capture handlers by position. If the source file reorders its `createServerFn` calls, or adds a new one, the test silently binds to the wrong handler.

**Affected files:** `apps/web/tests/unit/lib/api-server.test.ts`

**Recommendation:** Use the function name or a distinguishing characteristic (like the handler's URL pattern) to identify which handler is which, rather than relying on call order. Alternatively, mock `createServerFn` to return a builder that tags itself with the variable name from the source.

- **Implemented**: 2026-03-06

---

### F13 -- Shared package tests are exemplary (no action needed)

**Priority:** Skip
**Category:** Observation
**Impact:** N/A

All 11 test files in `packages/shared/tests/` are pure-logic Zod schema and utility tests with zero mocking, clear fixture constants, and direct imports. The `storage-contract.test.ts` provides a reusable contract test runner (`runStorageContractTests`). These are the gold standard for the codebase.

---

### F14 -- Web test helpers use dual-layer fixture pattern correctly

**Priority:** Skip
**Category:** Observation
**Impact:** N/A

The 10 web fixture helpers and 10 API fixture helpers correctly implement the `dual-layer-fixtures` pattern. Web fixtures use ISO strings + URLs; API fixtures use Date objects + storage keys. Both export `makeMock{Domain}(overrides?)` factories. No action needed.

---

### F15 -- Missing error-path tests in some web lib modules

**Priority:** P3
**Category:** Coverage gap
**Impact:** Low -- happy paths and common error paths are covered

`co2-equivalencies.test.ts` and `offset-impact.test.ts` test pure functions with good edge cases. `url.test.ts` is thorough. However, `auth.test.ts` does not test the `hasRole` export (it's tested transitively through component tests). `format.test.ts` does not test `formatPrice`, `formatInterval`, or `formatIntervalShort`.

**Recommendation:** Add missing tests for `formatPrice`, `formatInterval`, `formatIntervalShort` in `format.test.ts`. Add direct `hasRole` tests in `auth.test.ts`. Low priority since these are tested transitively.

- **Implemented**: 2026-03-07

---

## Priority Summary

| Priority | Count | Estimated LOC saved | Description |
|----------|-------|-------------------|-------------|
| **P0** | 3 | ~1,400 | Router mock (F1), auth mock (F2), API route factory (F4) |
| **P1** | 3 | ~210 | Format mock (F3), route component extractor (F5), api-server fragility (F12) |
| **P2** | 4 | ~130 | SubscribeCta stubs (F6), `as any` casts (F8), fetch mock helper (F10), fake timers (F11) |
| **P3** | 1 | ~30 | Missing format/auth coverage (F15) |
| **Skip** | 3 | -- | Shared tests exemplary (F13), fixtures correct (F14), audio querySelector OK (F9 partial) |

**Total estimated savings:** ~1,770 lines of duplicated/boilerplate code

---

## Implementation Order

### Phase 1: Shared test infrastructure (P0)

1. **F4 -- API route test factory** (highest impact, 11 files, ~700 lines)
   - Create `apps/api/tests/helpers/route-test-factory.ts`
   - Migrate one route test (e.g., `me.routes.test.ts` -- simplest) as proof
   - Roll out to remaining 10 route test files
   - Validate: `pnpm --filter @snc/api test`

2. **F1 -- Router mock helper** (31 files, ~500 lines)
   - Create `apps/web/tests/helpers/router-mock.ts`
   - Migrate one component test (e.g., `content-card.test.tsx`) as proof
   - Roll out to remaining 30 files
   - Validate: `pnpm --filter @snc/web test`

3. **F2 -- Auth mock helper** (13 files, ~200 lines)
   - Create `apps/web/tests/helpers/auth-mock.ts`
   - Migrate one file (e.g., `nav-bar.test.tsx`) as proof
   - Roll out to remaining 12 files
   - This will also resolve F7 (landing tests) as a side effect
   - Validate: `pnpm --filter @snc/web test`

### Phase 2: Secondary helpers (P1)

4. **F3 -- Format mock helper** (13 files, ~100 lines)
   - Create `apps/web/tests/helpers/format-mock.ts`
   - Roll out across 13 files
   - Validate: `pnpm --filter @snc/web test`

5. **F5 -- Route component extractor** (16 files, ~65 lines)
   - Create `apps/web/tests/helpers/route-test-utils.ts`
   - Roll out across 16 route test files
   - Validate: `pnpm --filter @snc/web test`

6. **F12 -- Fix api-server test fragility** (1 file)
   - Refactor handler capture to use non-positional identification
   - Validate: `pnpm --filter @snc/web test`

### Phase 3: Cleanup (P2)

7. **F8 -- Replace `as any` casts** (10 files, 23 occurrences)
   - Start with `emissions.routes.test.ts` (9 occurrences)
   - Create typed mock factories where needed
   - Validate: `pnpm --filter @snc/api test`

8. **F10 -- Fetch mock helper** (4 files)
   - Create `apps/web/tests/helpers/fetch-mock.ts`
   - Roll out to booking, creator, dashboard, auth lib tests
   - Validate: `pnpm --filter @snc/web test`

9. **F6 -- Component stub helpers** (3 files)
   - Create `apps/web/tests/helpers/component-stubs.ts`
   - Roll out to video-detail, audio-detail, written-detail
   - Validate: `pnpm --filter @snc/web test`

10. **F11 -- Fake timers consistency** (1 file)
    - Refactor `format.test.ts` to use `beforeEach`/`afterEach` timer setup
    - Validate: `pnpm --filter @snc/web test`

### Phase 4: Coverage (P3)

11. **F15 -- Missing format/auth tests** (2 files)
    - Add `formatPrice`, `formatInterval`, `formatIntervalShort` tests
    - Add direct `hasRole` test
    - Validate: `pnpm --filter @snc/web test`

---

## Patterns Affected

| Pattern | Findings | Impact |
|---------|----------|--------|
| `vi-hoisted-module-mock` | F1, F2, F3 | Helpers will encapsulate the hoisted pattern |
| `hono-test-app-factory` | F4 | Factory will standardize app assembly |
| `vi-doMock-dynamic-import` | F4, F5 | Factory/extractor will encapsulate doMock lifecycle |
| `dual-layer-fixtures` | F14 | No change needed -- already correct |
| `fake-timers-deterministic-testing` | F11 | Enforce consistency with pattern |
| `drizzle-chainable-mock` | F4, F8 | Route factory should include typed Drizzle mock helpers |
| `vi-import-original-partial-mock` | F3 | Format mock helper should support partial mocking |

---

## New Patterns to Document

After implementation, consider adding:

1. **`shared-router-mock`** -- Shared TanStack Router mock factory for web tests
2. **`route-test-factory`** -- API route test context factory encapsulating vi.doMock boilerplate
3. **`route-component-extractor`** -- Type-safe extraction of route components for testing

---

## Validation

After each phase, run the full test suite for the affected package:
```bash
pnpm --filter @snc/api test    # 344 tests
pnpm --filter @snc/web test    # 567 tests
pnpm --filter @snc/shared test # 387 tests (should be unchanged)
```

All 1,298 tests must pass with zero regressions before proceeding to the next phase.
