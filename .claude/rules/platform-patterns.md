# Pattern Index

One line per pattern. Read the linked file for full details and code examples.

## API / Shared Layer
- **app-error-hierarchy**: Typed AppError subclasses carry `code`+`statusCode`; `errorHandler` maps them via `instanceof` → [app-error-hierarchy.md]
- **result-type**: `Result<T, E=AppError>` discriminated union; `ok()`/`err()` factories; narrowed by `.ok` boolean → [result-type.md]
- **zod-env-config**: `ENV_SCHEMA` + `parseConfig(env)` exported for test injection + module-level `config` singleton crashes at startup → [zod-env-config.md]
- **hono-test-app-factory**: Local `createTestApp()`/`setupCorsApp()` builds minimal Hono instance; `app.request()` for zero-dep HTTP calls in tests → [hono-test-app-factory.md]

## API / Auth Layer
- **hono-typed-env**: `*Env` type with `Variables` map passed as `Hono<Env>`/`MiddlewareHandler<Env>` generic; `c.get()`/`c.set()` fully typed → [hono-typed-env.md]
- **vi-doMock-dynamic-import**: `vi.doMock()` before dynamic `import()` to mock eagerly-initialized singletons; `vi.resetModules()` in `afterEach` for per-test isolation → [vi-doMock-dynamic-import.md]

## Content Management & Storage
- **storage-provider-singleton**: StorageProvider interface + exhaustive-switch factory + module-level singleton; routes import singleton directly; vi.doMock replaces it per test → [storage-provider-singleton.md]
- **storage-contract-test**: `runStorageContractTests(createProvider, cleanup)` generates standard describe block for any StorageProvider implementation; `textToStream`/`streamToText` helpers for stream assertions → [storage-contract-test.md]
- **route-private-helpers**: Unexported helper functions (findActiveContent, requireContentOwnership, resolveContentUrls) and shared ERROR_4xx constants eliminate handler duplication within a route file → [route-private-helpers.md]

## Frontend / Auth UI
- **tanstack-file-route**: Every route exports `Route = createFileRoute(path)(options)`; `beforeLoad` throws `redirect()` for auth/role guards; `loader` fetches data and `Route.useLoaderData()` accesses it type-safely → [tanstack-file-route.md]
- **zod-mini-form-validation**: Module-level `zod/mini` schema + `useState` per field + `validate()` callback + `extractFieldErrors()` + `isSubmitting` gate → [zod-mini-form-validation.md]
- **css-modules-design-tokens**: `:root` CSS custom properties in `global.css`; all component `.module.css` files consume via `var(--token-name)` → [css-modules-design-tokens.md]
- **vi-hoisted-module-mock**: `vi.hoisted()` lifts mock fns before `vi.mock()` factories; component imported after all mocks; `beforeEach` sets defaults, `afterEach` restores → [vi-hoisted-module-mock.md]

## Content Feed & Media Playback
- **react-context-reducer-provider**: Separate State/Actions/ContextValue interfaces + exported pure reducer + INITIAL_STATE for testability; Provider bridges DOM ref via useMemo actions; null-guard consumer hook → [react-context-reducer-provider.md]
- **content-type-dispatch**: `Record<FeedItem["type"], T>` constants for exhaustive per-variant values (labels, CSS); inline `{item.type === "X" && <XVariant />}` dispatch; each variant receives shared FeedItem and extracts its own fields → [content-type-dispatch.md]

## Creator Pages & Profiles
- **cursor-encode-decode**: `encodeCursor`/`decodeCursor` in `cursor.ts` encode base64URL keyset tokens; `buildPaginatedResponse<T>(rows, limit, cursorFields)` encapsulates limit+1/pop/encode; `or(lt, and(eq, lt))` SQL for DESC, `or(gt, and(eq, gt))` for ASC → [cursor-encode-decode.md]
- **use-cursor-pagination**: Generic `useCursorPagination<T>({ buildUrl, deps? })` hook accumulates items across pages; `deps` triggers full reset+refetch when filters change; used in feed, creators list, creator detail → [use-cursor-pagination.md]
- **upload-replace-workflow**: Parameterized `handleImageUpload(c, field)` private handler enforces: ownership → Content-Length pre-check → parse multipart → MIME validate → sanitize → delete-old → upload-new → DB-update → response → [upload-replace-workflow.md]
- **listing-page-shared-css**: `listing-page.module.css` provides shared `.heading`, `.status`, `.loadMoreWrapper`, `.loadMoreButton` for all listing pages; import alongside page-specific module → [listing-page-shared-css.md]
- **human-readable-url-slug**: Prefer `handle ?? id` in user-facing URL params; backend dual-mode resolver accepts both; keep UUID for API data fetches and React keys → [human-readable-url-slug.md]

## Subscriptions & Content Gating
- **stripe-service-layer**: Module-level `stripe` singleton + `wrapStripeError` (via `wrapExternalError` factory) converts Stripe exceptions to `AppError`(502); all exports return `Result<T, AppError>`; mocked wholesale in tests via `vi.doMock` → [stripe-service-layer.md]
- **webhook-idempotent-dispatch**: 4-step flow: raw body text → verify signature (Result) → INSERT idempotency check (duplicate key = 200 OK) → `Record<string, handler | undefined>` dispatch; unknown events silently acknowledged → [webhook-idempotent-dispatch.md]
- **content-access-gate**: `checkContentAccess(userId, creatorId, visibility): Promise<ContentGateResult>` with 5 priority rules; discriminated union `{ allowed: true } | { allowed: false; reason; creatorId }` lets callers throw 401 vs 403 → [content-access-gate.md]

## Shopify Merch Storefront
- **external-error-factory**: `wrapExternalError(code)` factory curries error code → `(e: unknown) => AppError(502)`; both Stripe and Shopify services specialize it at module scope → [external-error-factory.md]
- **web-fetch-client**: `apiGet<T>(endpoint, params?)` / `apiMutate<T>(endpoint, {method, body})` generic helpers in `fetch-utils.ts`; all lib modules import these instead of raw fetch; `throwIfNotOk` underlies both → [web-fetch-client.md]

## Service Booking
- **row-to-response-transformer**: Private `toXxxResponse(row)` functions convert DB rows (Date objects, storage keys) to API shapes (ISO strings, URLs); composed for nested objects → [row-to-response-transformer.md]
- **drizzle-chainable-mock**: Each Drizzle chain node is a separate `vi.fn()`; intermediate nodes use `.mockReturnValue({nextMethod})`, terminal nodes use `.mockResolvedValue([])`; re-wired in `beforeEach` after `vi.resetAllMocks()` → [drizzle-chainable-mock.md]
- **dual-layer-fixtures**: API fixtures in `api/tests/helpers/` use Date objects + storage keys; web fixtures in `web/tests/helpers/` use ISO strings + URLs; both export `makeMock{Domain}(overrides?)` → [dual-layer-fixtures.md]

## Cooperative Dashboard
- **fake-timers-deterministic-testing**: `vi.useFakeTimers()` + `vi.setSystemTime(date)` per test freezes clock for date formatting, range calculations, polling; always restore with `vi.useRealTimers()` → [fake-timers-deterministic-testing.md]

## Bandcamp Integration
- **shared-validation-constants**: Regex constants exported from `@snc/shared` used in both server Zod schemas and client `zod/mini` schemas; prevents drift by defining validation rules once → [shared-validation-constants.md]

## Landing Page Polish
- **vi-import-original-partial-mock**: `vi.mock(m, async (importOriginal) => { const actual = await importOriginal<T>(); return { ...actual, mockFn } })` preserves pure utilities while replacing async functions; pair with `vi.hoisted()` → [vi-import-original-partial-mock.md]

> Note: Landing section data (featured creators, recent content) is fetched server-side via the `loader` function in `routes/index.tsx` and passed as props to components. Do not use a client-side hook for new landing sections — use `loader` + `Route.useLoaderData()` instead (see `tanstack-file-route.md`).
