---
name: platform-patterns
description: "Project code patterns and conventions. Auto-loads when implementing,
  designing, verifying, or reviewing code. Provides detailed pattern definitions
  with code examples."
user-invocable: false
allowed-tools: Read, Glob, Grep
---

# Project Patterns Reference

This skill contains detailed pattern documentation for this project.
See individual pattern files for full details with code examples.

Available patterns:

### API / Shared Layer
- [app-error-hierarchy.md](app-error-hierarchy.md) — Typed AppError subclasses carry code+statusCode; errorHandler maps them via instanceof
- [result-type.md](result-type.md) — Result<T, E=AppError> discriminated union; ok()/err() factories; narrowed by .ok boolean
- [thin-handlers-fat-services.md](thin-handlers-fat-services.md) — Route handlers parse/validate/delegate/respond (~30 lines); business logic lives in services/ returning Result<T, AppError> or typed unions
- [zod-env-config.md](zod-env-config.md) — ENV_SCHEMA + parseConfig(env) exported for test injection + module-level config singleton
- [hono-test-app-factory.md](hono-test-app-factory.md) — Local factory builds minimal Hono instance; app.request() for zero-dep HTTP calls in tests

### API / Auth Layer
- [hono-typed-env.md](hono-typed-env.md) — `*Env` type with `Variables` map as Hono/MiddlewareHandler generic for typed c.get()/c.set()
- [vi-doMock-dynamic-import.md](vi-doMock-dynamic-import.md) — vi.doMock() before dynamic import() for per-test mock isolation; vi.resetModules() in afterEach

### Content Management & Storage
- [storage-provider-singleton.md](storage-provider-singleton.md) — StorageProvider interface + exhaustive-switch factory + module-level singleton; vi.doMock replaces it in tests
- [storage-contract-test.md](storage-contract-test.md) — runStorageContractTests(createProvider, cleanup) shared contract test suite; textToStream/streamToText helpers
- [route-private-helpers.md](route-private-helpers.md) — Unexported helpers and ERROR_4xx constants eliminate handler duplication within a route file

### Frontend / Auth UI
- [tanstack-file-route.md](tanstack-file-route.md) — Every route exports Route = createFileRoute(path)(options); beforeLoad uses fetchAuthStateServer() + buildLoginRedirect() + AccessDeniedError for auth; errorComponent: RouteErrorBoundary; loader uses fetchApiServer() for SSR data
- [zod-mini-form-validation.md](zod-mini-form-validation.md) — Module-level zod/mini schema + useState per field + validate() + extractFieldErrors() + isSubmitting gate
- [vi-hoisted-module-mock.md](vi-hoisted-module-mock.md) — vi.hoisted() lifts mock fns before vi.mock() factories; component imported after mocks; beforeEach sets defaults

### Content Feed & Media Playback
- [react-context-reducer-provider.md](react-context-reducer-provider.md) — Separate State/Actions/ContextValue interfaces + exported pure reducer + INITIAL_STATE; Provider bridges DOM ref via useMemo actions; null-guard consumer hook
- [content-type-dispatch.md](content-type-dispatch.md) — Record<FeedItem["type"], T> for exhaustive per-variant values; inline conditional rendering dispatch to variant components; each variant extracts its own fields from shared FeedItem

### Creator Pages & Profiles
- [cursor-encode-decode.md](cursor-encode-decode.md) — encodeCursor/decodeCursor/decodeRawCursor in lib/cursor.ts; buildCursorCondition for keyset WHERE clause; buildPaginatedResponse<T> for limit+1/slice/encode
- [use-cursor-pagination.md](use-cursor-pagination.md) — Generic useCursorPagination<T>({ buildUrl, deps? }) hook; deps array resets on filter change; loadMore() appends next page; used in feed, creators list, creator detail
- [upload-replace-workflow.md](upload-replace-workflow.md) — Parameterized private handler: ownership → size pre-check → parse → MIME validate → sanitize → delete-old → upload-new → DB-update; used for avatar/banner and content media fields

### Creator Pages & Profiles (continued)
- [listing-page-shared-css.md](listing-page-shared-css.md) — `listing-page.module.css` provides shared .heading, .status, .loadMoreWrapper, .loadMoreButton; import alongside page-specific module in all listing routes
- [human-readable-url-slug.md](human-readable-url-slug.md) — Prefer `handle ?? id` in user-facing URL params; backend dual-mode resolver accepts both; keep UUID for API data fetches and React keys

### Subscriptions & Content Gating
- [stripe-service-layer.md](stripe-service-layer.md) — getStripe() factory from stripe-client.ts (Stripe optional, 503 when unconfigured) + wrapStripeErrorGranular for typed HTTP status mapping + all exports return Result<T, AppError>
- [webhook-idempotent-dispatch.md](webhook-idempotent-dispatch.md) — 4-step flow: raw text → verify signature → INSERT idempotency check → Record<string, handler | undefined> dispatch; unknown events silently acknowledged
- [content-access-gate.md](content-access-gate.md) — checkContentAccess() returns ContentGateResult discriminated union with 5 priority rules; callers branch on .reason for 401 vs 403

### Shopify Merch Storefront
- [external-error-factory.md](external-error-factory.md) — wrapExternalError(code) factory → (e: unknown) => AppError(502) for blanket-502 services (Shopify, Owncast); Stripe uses wrapStripeErrorGranular for per-error-type statuses
- [web-fetch-client.md](web-fetch-client.md) — extractErrorMessage + throwIfNotOk foundation; apiGet<T> / apiMutate<T> / apiUpload<T> generic helpers in fetch-utils.ts; all client-side lib modules import these

### Service Booking
- [row-to-response-transformer.md](row-to-response-transformer.md) — Private toXxxResponse(row) functions convert DB rows (Date objects, storage keys) to API response shapes (ISO strings, URLs); composed for nested objects
- [drizzle-chainable-mock.md](drizzle-chainable-mock.md) — Each Drizzle chain node is a separate vi.fn(); intermediate nodes use mockReturnValue, terminal nodes use mockResolvedValue; re-wired in beforeEach after vi.resetAllMocks()
- [dual-layer-fixtures.md](dual-layer-fixtures.md) — api/tests/helpers/ fixtures use Date objects + storage keys; web/tests/helpers/ fixtures use ISO strings + URLs; both export makeMock{Domain}(overrides?) factories

### Cooperative Dashboard
- [fake-timers-deterministic-testing.md](fake-timers-deterministic-testing.md) — vi.useFakeTimers() + vi.setSystemTime(date) freezes system clock per test for date formatting, range calculations, and polling; restore with vi.useRealTimers()

### Bandcamp Integration
- [shared-validation-constants.md](shared-validation-constants.md) — Regex constants exported from @snc/shared used in both server Zod schemas and client zod/mini schemas; prevents drift by defining validation predicates once

### Landing Page Polish
- [vi-import-original-partial-mock.md](vi-import-original-partial-mock.md) — vi.mock(m, async (importOriginal)) preserves real pure utility exports while replacing async functions; pair with vi.hoisted() for factory references
