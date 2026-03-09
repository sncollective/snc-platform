# Coding Conventions

## Naming
- camelCase for functions, variables, and object properties
- PascalCase for types, interfaces, classes, and React components
- SCREAMING_SNAKE_CASE for module-level constants
- kebab-case for file names (e.g., `booking-request.ts`, not `bookingRequest.ts`)
- Suffix Hono route handler files with `.routes.ts`; Drizzle schema files with `.schema.ts`

## Error Handling
- Use typed `AppError` subclasses (e.g., `NotFoundError`, `UnauthorizedError`) extending
  a base `AppError` class; never throw plain `Error` for expected failures
- API routes return structured JSON errors: `{ error: { code, message, details? } }`
- Hono middleware catches `AppError` instances and maps them to HTTP status codes
- Never let Stripe or Shopify errors propagate unhandled — wrap in `AppError` with context
- Use `Result<T, E>` types for service-layer functions that can fail predictably

## Imports
- Named exports only — no default exports anywhere in the codebase
- Use `node:` protocol for built-in modules (`node:fs`, `node:path`, `node:crypto`)
- Group imports: node builtins → external packages → internal workspace packages →
  relative imports; blank line between groups
- Import Zod as `import { z } from "zod"` in `packages/shared`; use `zod/mini` in
  `apps/web` for bundle size
- Reference shared types via the workspace alias `@snc/shared`, never via relative
  `../../packages/shared` paths

## Testing
- Use Vitest `describe` / `it` pattern; test files mirror `src/` structure under `tests/`
- Unit tests mock external services (Stripe, Shopify, storage provider) via `vi.mock()`
- Integration tests in `tests/integration/` use a real PostgreSQL container
- Every Hono route must have at least one happy-path test and one auth/validation failure test
- StorageProvider implementations must be tested via the shared provider contract test suite

## File Organization
- One module per file, named after its primary export
- `index.ts` files only for re-exports — no implementation in index files
- Hono app: routes grouped by domain under `src/routes/` (e.g., `src/routes/content.routes.ts`)
- Drizzle schemas co-located with their domain (e.g., `src/db/schema/content.schema.ts`)
- Storage providers in `apps/api/src/storage/` implementing `StorageProvider` interface
  from `packages/shared`

## Code Style
- TypeScript strict mode: `strict: true`, `noUncheckedIndexedAccess: true`,
  `exactOptionalPropertyTypes: true`
- Prefer `const` assertions and discriminated unions over enums
- `async/await` throughout — never `.then()` / `.catch()` chains
- Destructure function parameters when there are more than 2 arguments
- All Hono route handlers must be typed with `zValidator` input validation —
  never access `c.req.json()` without schema validation

## Docker Networking
- You are running inside a Docker container on the shared `claude-net` Docker network
- When starting project services, use the network override so containers join your network:
  `docker compose -f docker-compose.yml -f /tmp/claude-network-override.yml up -d`
- Use the container name to reach services — Docker DNS resolves them automatically:
  - `DATABASE_URL=postgres://snc:snc@snc-postgres:5432/snc`
- Fallback if shared network doesn't work: use `host.docker.internal` with the
  host-mapped port (e.g., `postgres://snc:snc@host.docker.internal:5432/snc`)

## Repository Context

### Key Directories
- `apps/api/src/` — Hono API server: app setup, config, middleware, DB connection
  - `app.ts` — Hono instance with OpenAPI 3.1, health route, auth routes, me route, content routes, creator routes, subscription routes, webhook routes, merch routes, booking routes, dashboard routes, CORS + error handler
  - `index.ts` — Server entry point with `@hono/node-server`, graceful shutdown
  - `config.ts` — Zod-validated env config (`DATABASE_URL`, `PORT`, `CORS_ORIGIN`,
    `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `STORAGE_TYPE`, `STORAGE_LOCAL_DIR`,
    `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
    `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_TOKEN`); exports `parseOrigins` and `parseConfig`
  - `auth/auth.ts` — Better Auth instance with Drizzle adapter, email/password provider,
    database hook assigning default "subscriber" role on signup
  - `auth/user-roles.ts` — `getUserRoles(userId)` service querying `user_roles` table
  - `db/connection.ts` — postgres.js client + Drizzle ORM instance
  - `db/schema/user.schema.ts` — Drizzle tables: `users`, `sessions`, `accounts`,
    `verifications` (Better Auth core) + `userRoles` (custom join table)
  - `db/schema/content.schema.ts` — Drizzle `content` table with 14 columns + 3 indexes
    (FK to `users`, soft-delete via `deletedAt`)
  - `db/schema/creator.schema.ts` — Drizzle `creator_profiles` table (1:1 with users,
    FK CASCADE; displayName, bio, avatarKey, bannerKey, socialLinks JSONB as `SocialLink[]`)
  - `db/schema/subscription.schema.ts` — Drizzle tables: `subscriptionPlans`, `userSubscriptions`,
    `paymentEvents` (subscription billing + webhook idempotency)
  - `db/schema/booking.schema.ts` — Drizzle tables: `services` (8 cols + active/sort index),
    `booking_requests` (10 cols + user/status + status/created indexes, FK to services + users)
  - `middleware/auth-env.ts` — `AuthEnv` typed Hono env with `user`, `session`, `roles`
  - `middleware/require-auth.ts` — session validation middleware (401 on failure)
  - `middleware/require-role.ts` — role authorization middleware factory (403 on failure)
  - `services/content-access.ts` — `checkContentAccess()` subscription-based content gating
    (5 priority rules: public, unauth, owner bypass, active subscription, reject)
  - `middleware/error-handler.ts` — `AppError` → structured JSON error responses
  - `middleware/cors.ts` — CORS for configured origins
  - `services/stripe.ts` — Stripe service module: `getOrCreateCustomer`, `createCheckoutSession`,
    `cancelSubscriptionAtPeriodEnd`, `verifyWebhookSignature` — all return `Result<T, AppError>`
  - `services/shopify.ts` — Shopify Storefront API client: `getProducts`, `getProductByHandle`,
    `createCheckoutUrl` — all return `Result<T, AppError>`; GraphQL queries for products + cart
  - `services/revenue.ts` — Stripe revenue service: `getMonthlyRevenue(months)` returns
    `Result<MonthlyRevenue[], AppError>`; queries paid invoices, groups by month, zero-fills
  - `services/external-error.ts` — `wrapExternalError(code)` factory curries error code →
    `(e: unknown) => AppError(502)`; used by Stripe, Shopify, and revenue services
  - `routes/auth.routes.ts` — Better Auth handler at `/api/auth/*` with OpenAPI docs
  - `routes/me.routes.ts` — `GET /api/me` returning user + session + roles (enriched session)
  - `routes/content.routes.ts` — Content CRUD + upload + media streaming + feed list (9 endpoints, gated via checkContentAccess)
  - `routes/creator.routes.ts` — Creator profile CRUD + avatar/banner upload/streaming + social links (7 endpoints)
  - `routes/subscription.routes.ts` — Subscription CRUD + checkout (4 endpoints: GET /plans, POST /checkout, POST /cancel, GET /mine)
  - `routes/webhook.routes.ts` — Stripe webhook handler (5 event types, idempotent via payment_events)
  - `routes/merch.routes.ts` — Merch listing + detail + checkout (3 endpoints: GET /merch, GET /merch/:handle, POST /merch/checkout)
  - `routes/dashboard.routes.ts` — Dashboard KPI endpoints (3 endpoints: GET /revenue, GET /subscribers, GET /bookings — all cooperative-member only)
  - `routes/booking.routes.ts` — Service listing + booking CRUD + review (7 endpoints: GET /services, GET /services/:id, POST /bookings, GET /bookings/mine, GET /bookings/:id, GET /bookings/pending, PATCH /bookings/:id/review)
  - `routes/openapi-errors.ts` — Shared `ErrorResponse` schema + `ERROR_4xx`/`ERROR_502`/`ERROR_503` constants
  - `routes/route-utils.ts` — Shared `getFrontendBaseUrl()` for constructing redirect URLs
  - `routes/file-utils.ts` — Shared `sanitizeFilename`, `inferContentType`, `streamFile`
  - `routes/cursor.ts` — Shared `encodeCursor`/`decodeCursor` for keyset pagination + `buildPaginatedResponse` helper
  - `storage/index.ts` — `createStorageProvider` factory + `storage` singleton
  - `storage/local-storage.ts` — Local filesystem `StorageProvider` implementation
- `apps/api/tests/` — Vitest tests mirroring `src/` structure (344 tests)
  - `helpers/test-constants.ts` — `TEST_CONFIG`, `makeTestConfig(overrides?)`
  - `helpers/auth-fixtures.ts` — `makeMockUser(overrides?)`, `makeMockSession(overrides?)`
  - `helpers/content-fixtures.ts` — `makeMockContent(overrides?)`, `makeMockDbContent(overrides?)`
  - `helpers/creator-fixtures.ts` — `makeMockDbCreatorProfile(overrides?)`
  - `helpers/subscription-fixtures.ts` — `makeMockPlan(overrides?)`, `makeMockSubscription(overrides?)`, Stripe event factories
  - `helpers/merch-fixtures.ts` — `makeMockProduct(overrides?)`, `makeMockProductDetail(overrides?)`, `makeMockShopifyProductNode(overrides?)`
  - `helpers/booking-fixtures.ts` — `makeMockService(overrides?)`, `makeMockBookingRequest(overrides?)`
  - `helpers/dashboard-fixtures.ts` — `makeMockMonthlyRevenue(overrides?)`, `makeMockStripeInvoice(overrides?)`
- `apps/web/src/` — TanStack Start frontend: React 19, SSR, file-based routing
  - `routes/__root.tsx` — Root layout with AudioPlayerProvider, NavBar, MiniPlayer, Footer, Outlet; skip-to-content link, `id="main-content"` on `<main>`
  - `routes/index.tsx` — Landing page with HeroSection, FeaturedCreators, RecentContent, LandingPricing
  - `routes/login.tsx` — Login page with guest redirect guard
  - `routes/register.tsx` — Register page with guest redirect guard
  - `routes/dashboard.tsx` — Cooperative dashboard: KPI cards, revenue chart, pending bookings table with approve/deny; `beforeLoad` checks session + cooperative-member role
  - `routes/feed.tsx` — Content feed page with filter bar, content grid, load-more pagination
  - `routes/content/$contentId.tsx` — Content detail page (video/audio/written dispatch)
  - `routes/creators/index.tsx` — Creator listing page with grid and cursor pagination
  - `routes/creators/$creatorId.tsx` — Creator detail page (header, content grid, filter, subscription integration, merch section, social links section)
  - `routes/pricing.tsx` — Public pricing page with platform plan cards
  - `routes/checkout/success.tsx` — Post-checkout success page (polls for subscription activation)
  - `routes/checkout/cancel.tsx` — Post-checkout cancel page
  - `routes/settings/subscriptions.tsx` — Subscription management page (list + cancel)
  - `routes/merch/index.tsx` — Merch listing page with product grid, cursor pagination, creatorId filter, success/cancel banners
  - `routes/merch/$handle.tsx` — Product detail page with loader and ProductDetail component
  - `routes/services.tsx` — Service listing page with booking request form (inline expand)
  - `routes/settings/bookings.tsx` — Booking request management page (auth guard + cursor pagination)
  - `routes/settings/creator.tsx` — Creator settings page (social links management via SOCIAL_PLATFORMS / SocialLink, creator role guard)
  - `components/layout/` — NavBar, UserMenu (includes Creator Settings link for creators), MobileMenu, Footer
  - `components/auth/` — LoginForm, RegisterForm
  - `components/content/` — ContentCard, FilterBar, ContentDetail, ContentMeta,
    VideoDetail, AudioDetail, WrittenDetail, SubscribeCta (+ CSS modules)
  - `components/creator/` — CreatorCard, CreatorHeader (+ CSS modules)
  - `components/media/` — VideoPlayer, AudioPlayer, MiniPlayer (+ CSS modules)
  - `components/subscription/` — PlanCard, SubscriptionList (+ CSS modules)
  - `components/merch/` — ProductCard, ProductDetail, VariantSelector (+ CSS modules)
  - `components/booking/` — ServiceCard, BookingForm, BookingList (+ CSS modules)
  - `components/social-links/` — SocialLinksSection (+ CSS modules)
  - `components/dashboard/` — KpiCard, RevenueChart, PendingBookingsTable (+ CSS modules)
  - `components/landing/` — HeroSection, FeaturedCreators, RecentContent, LandingPricing (+ CSS modules)
  - `contexts/audio-player-context.tsx` — Global audio playback state (reducer + provider + hook)
  - `lib/auth-client.ts` — Better Auth client instance (`createAuthClient`)
  - `lib/auth.ts` — `useSession`, `useRoles`, `fetchAuthState`, `hasRole` exports
  - `lib/config.ts` — `API_BASE_URL` constant from env
  - `lib/format.ts` — `formatRelativeDate`, `formatDate`, `formatTime`, `formatPrice`,
    `formatInterval`, `formatIntervalShort` utilities
  - `lib/url.ts` — `buildMediaUrl` utility for API URL construction
  - `lib/subscription.ts` — `fetchPlans`, `createCheckout`, `fetchMySubscriptions`, `cancelSubscription`, `hasPlatformSubscription`
  - `lib/merch.ts` — `fetchProducts`, `fetchProductByHandle`, `createMerchCheckout`
  - `lib/booking.ts` — `fetchServices`, `fetchServiceById`, `createBooking`, `fetchMyBookings`, `fetchBookingById`
  - `lib/creator.ts` — `fetchCreatorProfile`, `updateCreatorProfile` API helpers
  - `lib/dashboard.ts` — `fetchRevenue`, `fetchSubscribers`, `fetchBookingSummary`, `fetchPendingBookings`, `reviewBooking`
  - `lib/fetch-utils.ts` — `throwIfNotOk(response)`, `apiGet<T>(endpoint, params?)`, `apiMutate<T>(endpoint, {method, body})` shared fetch helpers
  - `lib/form-utils.ts` — `extractFieldErrors()` generic Zod issue → field error mapper
  - `hooks/use-menu-toggle.ts` — Shared menu open/close/escape/click-outside hook
  - `hooks/use-guest-redirect.ts` — Redirect authenticated users away from auth pages
  - `hooks/use-cursor-pagination.ts` — Generic `useCursorPagination<T>` hook for cursor-based pagination (supports `fetchOptions` for auth + `error` state)
  - `hooks/use-subscriptions.ts` — `useSubscriptions()` hook returning current user's active subscriptions
  - `config/navigation.ts` — `NAV_LINKS` constant and `NavLink` type (includes Pricing link)
  - `styles/global.css` — CSS custom properties (design tokens), base styles, content-grid utility
  - `styles/listing-page.module.css` — Shared listing page CSS (heading, status, loadMore) for feed, creators, merch, bookings
  - `styles/settings-page.module.css` — Shared settings page CSS (page, error) for subscriptions, bookings, creator settings
  - `styles/list-items.module.css` — Shared list item CSS (list, item, itemHeader, statusBadge, empty) for booking-list + subscription-list
  - `styles/landing-section.module.css` — Shared landing section CSS (section, heading, loading) for landing components
- `apps/web/tests/` — Vitest tests for web app (567 tests)
  - `helpers/auth-fixtures.ts` — `makeMockUser`, `makeMockSession`, `makeMockSessionResult`,
    `makeLoggedInSessionResult` factories
  - `helpers/content-fixtures.ts` — `makeMockFeedItem(overrides?)` factory
  - `helpers/audio-player-fixtures.ts` — `makeMockContext`, `TEST_TRACK` factories
  - `helpers/creator-fixtures.ts` — `makeMockCreatorListItem(overrides?)` factory
  - `helpers/subscription-fixtures.ts` — `makeMockPlan(overrides?)`, `makeMockUserSubscription(overrides?)`
  - `helpers/merch-fixtures.ts` — `makeMockMerchProduct(overrides?)`, `makeMockMerchProductDetail(overrides?)`
  - `helpers/booking-fixtures.ts` — `makeMockService(overrides?)`, `makeMockBookingWithService(overrides?)`
  - `helpers/dashboard-fixtures.ts` — `makeMockRevenueResponse(overrides?)`, `makeMockSubscriberSummary(overrides?)`, `makeMockBookingSummary(overrides?)`, `makeMockPendingBookingItem(overrides?)`
- `packages/shared/src/` — shared types and utilities (387 tests)
  - `auth.ts` — `ROLES`, `RoleSchema`, `UserSchema`, `SessionSchema`, `AuthSessionSchema`
    + `Role`, `User`, `Session`, `AuthSession` types
  - `errors.ts` — `AppError` base + `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ValidationError`
  - `result.ts` — `Result<T, E>` discriminated union with `ok()`/`err()` helpers
  - `content.ts` — `CONTENT_TYPES`, `VISIBILITY`, `CreateContentSchema`, `UpdateContentSchema`,
    `ContentResponseSchema`, `FeedQuerySchema`, `FeedItemSchema`, `FeedResponseSchema` + inferred types
  - `creator.ts` — `UpdateCreatorProfileSchema`, `CreatorProfileResponseSchema`,
    `CreatorListQuerySchema`, `CreatorListResponseSchema`, `SOCIAL_PLATFORMS`,
    `PLATFORM_CONFIG`, `SocialLinkSchema`, `MAX_SOCIAL_LINKS` + inferred types
  - `subscription.ts` — `PLAN_TYPES`, `PLAN_INTERVALS`, `SUBSCRIPTION_STATUSES`,
    `SubscriptionPlanSchema`, `CheckoutRequestSchema`, `CancelRequestSchema`,
    `UserSubscriptionWithPlanSchema`, `MySubscriptionsResponseSchema` + inferred types
  - `storage.ts` — `StorageProvider` interface, `UploadMetadata`, `UploadResult`,
    `ACCEPTED_MIME_TYPES`, `MAX_FILE_SIZES`
  - `storage-contract.ts` — `runStorageContractTests()`, `textToStream`, `streamToText`
  - `merch.ts` — `CREATOR_TAG_PREFIX`, `MerchProductSchema`, `MerchProductDetailSchema`,
    `MerchVariantSchema`, `MerchListQuerySchema`, `MerchListResponseSchema`,
    `MerchCheckoutRequestSchema`, `MerchCheckoutResponseSchema` + inferred types
  - `booking.ts` — `BOOKING_STATUSES`, `ServiceSchema`, `BookingRequestSchema`,
    `BookingWithServiceSchema`, `CreateBookingRequestSchema`, `MyBookingsQuerySchema`,
    `ServicesResponseSchema`, `BookingResponseSchema`, `MyBookingsResponseSchema`,
    `RequesterSchema`, `PendingBookingItemSchema`, `PendingBookingsQuerySchema`,
    `PendingBookingsResponseSchema`, `ReviewBookingRequestSchema` + inferred types
  - `dashboard.ts` — `MonthlyRevenueSchema`, `RevenueResponseSchema`,
    `SubscriberSummarySchema`, `BookingSummarySchema` + inferred types
  - `index.ts` — barrel re-exports
- `docker-compose.yml` — PostgreSQL 16 (`snc-postgres` container)
- `apps/api/drizzle.config.ts` — Drizzle Kit migration config
- `apps/api/drizzle/migrations/` — SQL migrations (auth tables + content table + creator_profiles table + subscription tables + booking tables)

### Build & Test
- `pnpm --filter @snc/api test` — run API unit tests (344 tests)
- `pnpm --filter @snc/shared test` — run shared package tests (387 tests)
- `pnpm --filter @snc/web test` — run web unit tests (567 tests)
- `pnpm --filter @snc/api dev` — start API dev server (Node 24+ with `--experimental-strip-types`)
- `pnpm --filter @snc/web dev` — start web dev server (TanStack Start on port 3001)
- `docker compose -f docker-compose.yml -f /tmp/claude-network-override.yml up -d` — start PostgreSQL

