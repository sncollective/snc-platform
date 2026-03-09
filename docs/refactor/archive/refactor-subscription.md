> **Archived**: 2026-03-09
> **Validation**: All tests passing, no cross-finding regressions

# Refactor Analysis: Subscription Domain Vertical Slice

> **Generated**: 2026-03-09
> **Scope**: 44 files analyzed across shared schema, API routes/services/tests, web lib/components/hooks/routes/tests
> **Libraries researched**: Hono v4.12, Drizzle v0.45, Vitest v4, Zod v4.3, Stripe v20.4

---

## Executive Summary

The subscription domain is well-structured and largely pattern-compliant. Analysis found no P0 security issues. The primary high-value finding is duplicated Stripe infrastructure between `stripe.ts` and `revenue.ts` (identical `STRIPE_KEY`, `getStripe()`, `ensureConfigured()` functions). Several OpenAPI response schemas are missing `502`/`503` error documentation for Stripe-originated errors. Cross-layer analysis found strong alignment, with minor fixture default value differences and two `as` casts in `ensureConfigured()` returns that could be eliminated.

---

## P0 — Fix Now

None found.

---

## P1 — High Value

### 1.1 Duplicated Stripe Infrastructure Between `stripe.ts` and `revenue.ts`

- **Affected files**:
  - `apps/api/src/services/stripe.ts:20-47` (`STRIPE_KEY`, `getStripe()`, `ensureConfigured()`)
  - `apps/api/src/services/revenue.ts:10-36` (identical `STRIPE_KEY`, `getStripe()`, `ensureConfigured()`)
- **Current state**: Both files declare identical module-level `STRIPE_KEY` extraction, identical `stripeInstance` singleton with identical lazy `getStripe()` factory, and identical `ensureConfigured()` Result guard. The only difference is the error wrapper name (`wrapStripeError` vs `wrapRevenueError`).
- **Proposed consolidation**: Extract shared Stripe infrastructure into a new `apps/api/src/services/stripe-client.ts` module:
  ```typescript
  // Exports: getStripe(), ensureConfigured()
  // stripe.ts and revenue.ts import from here
  ```
  Each service retains its own `wrapExternalError()` specialization and public API functions.
- **Estimated scope**: 3 files changed (~30 lines extracted, ~20 lines removed per consumer), net ~-20 LOC
- **Pattern reference**: `external-error-factory` (wrappers stay per-service), new shared client pattern
- **Tests affected**: `apps/api/tests/services/stripe.test.ts`, `apps/api/tests/services/revenue.test.ts` — both need to `vi.doMock` the new `stripe-client.js` module instead of mocking `stripe` constructor in each
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 1.2 `ensureConfigured()` Returns Use Unsafe `as` Casts to Reinterpret `Result<void>` to Different `Result<T>`

- **Affected files**:
  - `apps/api/src/services/stripe.ts:62` (`return configured as Result<string, AppError>`)
  - `apps/api/src/services/stripe.ts:95` (`return configured as Result<string, AppError>`)
  - `apps/api/src/services/stripe.ts:153` (`return configured as Result<Stripe.Event, AppError>`)
  - `apps/api/src/services/revenue.ts:44` (`return configured as Result<MonthlyRevenue[], AppError>`)
- **Current state**: `ensureConfigured()` returns `Result<void, AppError>`. When it fails, callers cast the `Err<AppError>` to a different `Result<T, AppError>` using `as`. This is type-safe at runtime (the `Err` branch doesn't carry a `value`), but the cast silences TypeScript, creating a drift risk if `Result<T>` internals change.
- **Proposed consolidation**: Make `ensureConfigured()` generic:
  ```typescript
  const ensureConfigured = <T>(): Result<T, AppError> => {
    if (STRIPE_KEY === null) {
      return err(new AppError("BILLING_NOT_CONFIGURED", "...", 503));
    }
    // Return type forces callers to produce `ok(value)` themselves
    return ok(undefined as unknown as T); // or restructure to early-return pattern
  ```
  Better approach: restructure callers to use early-return guard pattern:
  ```typescript
  const configured = ensureConfigured();
  if (!configured.ok) return err(configured.error);
  ```
  This eliminates all 4 `as Result<T>` casts.
- **Estimated scope**: 2 files, ~8 lines changed
- **Pattern reference**: `result-type` pattern says callers narrow via `.ok` — this aligns with narrowing then returning `err()` directly
- **Tests affected**: None — behavior unchanged
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 1.3 Missing OpenAPI `502`/`503` Error Documentation on Subscription Routes

- **Affected files**:
  - `apps/api/src/routes/subscription.routes.ts:108-120` (GET /plans — no 502/503)
  - `apps/api/src/routes/subscription.routes.ts:154-167` (POST /checkout — no 502/503)
  - `apps/api/src/routes/subscription.routes.ts:222-237` (POST /cancel — no 502/503)
- **Current state**: All three subscription routes can produce 502 (Stripe API failure) or 503 (Stripe not configured), but their `describeRoute()` responses only list 400/401/403/404. The shared `ERROR_502` and `ERROR_503` constants exist in `openapi-errors.ts` but are not imported or used.
- **Proposed consolidation**: Import `ERROR_502` and `ERROR_503` from `openapi-errors.js` and add to the `responses` object for POST /checkout and POST /cancel. GET /plans does not call Stripe so only needs no changes.
- **Estimated scope**: 1 file, ~6 lines added
- **Pattern reference**: `route-private-helpers` (shared OpenAPI error constants)
- **Tests affected**: None — OpenAPI metadata only
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P2 — Medium Value

### 2.1 `handleSubscribe` Logic Duplicated Between `pricing.tsx` and `landing-pricing.tsx`

- **Location**: `apps/web/src/routes/pricing.tsx:39-55`, `apps/web/src/components/landing/landing-pricing.tsx:23-30`
- **Affected files**: Both files
- **Issue**: Both define a nearly identical `handleSubscribe` function that checks `isAuthenticated`, redirects to `/login` if not, and otherwise calls `createCheckout`/`handleCheckout`. The landing component already uses `useCheckout` hook, but `pricing.tsx` duplicates the checkout flow inline with its own `try/catch` + `setLoadingPlanId` + `setError` + `navigateExternal`.
- **Suggestion**: Refactor `pricing.tsx` to use `useCheckout({ onError: (msg) => setError(msg) })` hook. Extend `useCheckout` to accept `onError: (message: string) => void` instead of `onError: () => void` to pass the error message. This eliminates the duplicated try/catch/navigate pattern.
- **Tests affected**: `apps/web/tests/unit/routes/pricing.test.tsx`, `apps/web/tests/unit/hooks/use-checkout.test.ts`
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 2.2 `SubscribeCta` Uses Direct `useSession` Instead of `usePlatformAuth`

- **Location**: `apps/web/src/components/content/subscribe-cta.tsx:46`
- **Affected files**: `subscribe-cta.tsx`
- **Issue**: `SubscribeCta` derives `isAuthenticated` from `useSession()` directly: `const isAuthenticated = session.data !== null`. The `usePlatformAuth` hook encapsulates this exact derivation alongside subscription status. While `SubscribeCta` doesn't need subscription status (it fetches creator-specific plans), the authentication check pattern is identical and could use `usePlatformAuth().isAuthenticated` for consistency.
- **Suggestion**: Replace `useSession()` + manual `isAuthenticated` derivation with `usePlatformAuth().isAuthenticated` in `SubscribeCta`. This consolidates the "is user logged in?" check to a single pattern. Note: `SubscribeCta` would gain a subscription fetch side-effect via `useSubscriptions` inside `usePlatformAuth` — evaluate whether this is acceptable overhead.
- **Tests affected**: `apps/web/tests/unit/components/subscribe-cta.test.tsx`
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 2.3 `SubscribeCta` Fetches Plans Client-Side Instead of Via Loader

- **Location**: `apps/web/src/components/content/subscribe-cta.tsx:53-78`
- **Affected files**: `subscribe-cta.tsx`
- **Issue**: Per the landing section data note in `patterns.md`, data should be fetched server-side via `loader` + `Route.useLoaderData()`, not via client-side hooks. `SubscribeCta` uses `useEffect` + `fetchPlans({ creatorId })` to load plans on mount. However, `SubscribeCta` is embedded within the content detail page which already has a `loader` — the plans could be fetched there and passed as props.
- **Suggestion**: Consider adding plan data to the content detail route's `loader` and passing it to `SubscribeCta` as props. This would eliminate the client-side fetch and loading state in the component. Note: this pattern note specifically targets landing sections, and `SubscribeCta` renders conditionally within content detail — evaluate whether the complexity is warranted.
- **Tests affected**: `apps/web/tests/unit/components/subscribe-cta.test.tsx`, content detail route test
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 2.4 `cancelSubscription` Web Lib Returns `void` But API Returns Subscription+Plan

- **Location**: `apps/web/src/lib/subscription.ts:63-68` (returns `Promise<void>`)
- **Affected files**: `subscription.ts`, `settings/subscriptions.tsx`
- **Issue**: The API `POST /cancel` returns `{ subscription: UserSubscriptionWithPlan }` but `cancelSubscription()` in the web lib discards this response by using `apiMutate<void>`. The `SubscriptionManagementPage` then makes a separate `fetchMySubscriptions()` call to refresh the list. While this works, it wastes the response data and requires an extra network round-trip.
- **Suggestion**: Change `cancelSubscription` to return `UserSubscriptionWithPlan` and use it to optimistically update the list, falling back to a full refresh only on error. This eliminates one API call per cancel action.
- **Tests affected**: `apps/web/tests/unit/routes/subscription-management.test.tsx`
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 2.5 Webhook Handler Type Casts for Stripe Event Data

- **Location**: `apps/api/src/routes/webhook.routes.ts:212` (`const event = verifyResult.value as unknown as StripeEventData`)
- **Affected files**: `webhook.routes.ts`
- **Issue**: The double cast `as unknown as StripeEventData` bypasses TypeScript's structural checks. While `verifyWebhookSignature` returns `Result<Stripe.Event, AppError>` and `StripeEventData` is a minimal subset, the cast could mask future field changes.
- **Suggestion**: Define `StripeEventData` as `Pick<Stripe.Event, 'id' | 'type' | 'data'>` or use a Zod `.pick()` refinement on the verified event. Alternatively, since the handler functions already do their own field extraction with safety checks, the cast is low-risk and could be annotated with a comment explaining why.
- **Tests affected**: None
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P3 — Nice-to-Have

- `apps/web/src/routes/checkout/success.tsx:10-11`: Magic numbers `MAX_POLL_ATTEMPTS = 5` and `POLL_INTERVAL_MS = 2000` — consider extracting to a shared constants module if reused elsewhere.
- `apps/web/src/routes/checkout/success.module.css` and `cancel.module.css`: Duplicated `.heading`, `.message` styles with identical properties. Could share a `checkout-shared.module.css`.
- `apps/web/src/components/subscription/subscription-list.tsx:20-28`: `getStatusLabel` uses string comparisons for `status` — could use a `Record<SubscriptionStatus, string>` map for exhaustiveness.
- `apps/api/src/routes/subscription.routes.ts:97-99`: `CancelResponseSchema` is only used locally but defined at module scope — correct per `route-private-helpers` pattern, but could benefit from a comment referencing the pattern.
- `apps/api/src/routes/webhook.routes.ts:47-76`: `handleCheckoutCompleted` at 29 lines is the longest handler — within the ~40 line guideline but nearing it.
- `apps/web/src/routes/pricing.tsx:73`: `Link to={"/settings/subscriptions" as never}` — the `as never` cast suggests a routing type issue; investigate whether the route is properly registered in the TanStack file router type tree.

---

## Skip — Intentional Patterns

| Pattern | Location | Why it stays |
|---------|----------|-------------|
| Drizzle enum `as PlanType` / `as PlanInterval` / `as SubscriptionStatus` casts in transformers | `subscription.routes.ts:62,65,83` | Known Drizzle `text()` → union type gap; shared across all route transformers. See `row-to-response-transformer` pattern. |
| `c.req.valid("query" as never) as PlansQuery` | `subscription.routes.ts:125` | Known hono-openapi limitation. Tracked upstream. See `hono-typed-env` pattern "Known Workaround" section. |
| Separate API/web fixture files with Date vs ISO string formats | `api/tests/helpers/subscription-fixtures.ts`, `web/tests/helpers/subscription-fixtures.ts` | Intentional per `dual-layer-fixtures` pattern. |
| `useSubscriptions` silently swallows fetch errors | `apps/web/src/hooks/use-subscriptions.ts:28-31` | Documented as intentional: "subscription status is supplementary." |
| `handleCheckoutCompleted` silent return on missing metadata | `webhook.routes.ts:58-64` | Per `webhook-idempotent-dispatch` pattern: handlers must not throw, as Stripe retries on non-200. |

---

## Best Practices Research

### Stripe v20.4

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `wrapExternalError("STRIPE_ERROR")` wraps all Stripe exceptions as 502 | Stripe SDK v20+ exposes typed `Stripe.errors.StripeError` subclasses; could differentiate `StripeCardError` (4xx) from `StripeConnectionError` (5xx) | Medium — would improve error specificity but requires changes to `wrapExternalError` factory |
| Manual `STRIPE_KEY ?? null` extraction from config | Current approach is fine — lazy initialization via `getStripe()` is correct | None |
| `constructEvent` for webhook verification | Correct per Stripe docs | None |

### Vitest v4

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `vi.restoreAllMocks()` in `afterEach` across 19 call sites | Vitest v4 changes `vi.restoreAllMocks()` behavior — audit needed | Low — verify existing behavior still correct |
| `vi.clearAllMocks()` in `beforeEach` within `setupRouteTest` | Correct — factory handles lifecycle | None |

---

## OSS Alternatives

No candidates identified. The Stripe integration is thin and well-encapsulated; no additional libraries would provide meaningful benefit.

---

## Pattern Compliance

| Pattern | Status | Notes |
|---------|--------|-------|
| `stripe-service-layer` | **Compliant** | All Stripe calls return `Result<T, AppError>`. Private `wrapStripeError` via factory. Module-level singleton with lazy init. |
| `webhook-idempotent-dispatch` | **Compliant** | 4-step flow: raw body → verify → INSERT dedup → dispatch map. Handlers silently return on missing data. |
| `content-access-gate` | **Compliant** | 6 priority rules implemented. Both `checkContentAccess` (per-item) and `buildContentAccessContext`/`hasContentAccess` (batch) variants exist. |
| `external-error-factory` | **Compliant** | `stripe.ts` and `revenue.ts` both specialize `wrapExternalError`. Webhook signature errors use manual `AppError` with 400 (correct per pattern). |
| `result-type` | **Fixed** | `ensureConfigured()` callers now use early-return guard pattern — no `as` casts (P1.2). |
| `row-to-response-transformer` | **Compliant** | `toPlanResponse` and `toSubscriptionWithPlanResponse` are private, pure, use shared return types. |
| `route-private-helpers` | **Compliant** | Private helpers unexported. `CancelResponseSchema` and error constants follow pattern. |
| `hono-typed-env` | **Compliant** | Routes typed with `Hono<AuthEnv>`. Known `as never` cast for `c.req.valid()`. |
| `hono-test-app-factory` | **Compliant** | Subscription and webhook tests use `setupRouteTest` factory. |
| `vi-doMock-dynamic-import` | **Compliant** | Stripe service test uses `vi.doMock("stripe", ...)` with regular function constructor. |
| `drizzle-chainable-mock` | **Compliant** | Both route tests use chainable mocks with proper re-wiring. `chainablePromise` utility used for UPDATE chains. |
| `dual-layer-fixtures` | **Compliant** | API fixtures use `Date` objects, web fixtures use ISO strings. See Fixture Sync below. |
| `vi-hoisted-module-mock` | **Compliant** | All web tests use `vi.hoisted()` for mock function declarations. |
| `web-fetch-client` | **Compliant** | `subscription.ts` uses `apiGet`/`apiMutate`. `cancelSubscription` returns `UserSubscriptionWithPlan` (P2.4). |
| `app-error-hierarchy` | **Compliant** | Routes throw `NotFoundError`, `ForbiddenError`, `ValidationError`. |
| `css-modules-design-tokens` | **Compliant** | All CSS modules use `var(--token)` references. No hardcoded values found. |
| `listing-page-shared-css` | **Compliant** | `settings/subscriptions.tsx` uses `listingStyles.heading` and `listingStyles.status`. |
| `shared-validation-constants` | **N/A** | No subscription-specific regex validation constants needed. `PLAN_TYPES`, `PLAN_INTERVALS`, `SUBSCRIPTION_STATUSES` are used via Zod enum schemas, not as standalone regex constants. |

---

## Cross-Layer Continuity

### Schema-Transformer Alignment

| Shared Schema Field | Transformer Output | Status | Notes |
|---|---|---|---|
| `SubscriptionPlanSchema.id` | `toPlanResponse → id` | Aligned | Direct passthrough |
| `SubscriptionPlanSchema.name` | `toPlanResponse → name` | Aligned | Direct passthrough |
| `SubscriptionPlanSchema.type` | `toPlanResponse → type` | Aligned | `as PlanType` cast (known-safe Drizzle pattern) |
| `SubscriptionPlanSchema.creatorId` | `toPlanResponse → creatorId` | Aligned | `?? null` for nullable |
| `SubscriptionPlanSchema.price` | `toPlanResponse → price` | Aligned | Direct passthrough |
| `SubscriptionPlanSchema.interval` | `toPlanResponse → interval` | Aligned | `as PlanInterval` cast (known-safe) |
| `SubscriptionPlanSchema.active` | `toPlanResponse → active` | Aligned | Direct passthrough |
| `SubscriptionPlanSchema.createdAt` | `toPlanResponse → createdAt` | Aligned | `.toISOString()` |
| `SubscriptionPlanSchema.updatedAt` | `toPlanResponse → updatedAt` | Aligned | `.toISOString()` |
| `UserSubscriptionSchema.id` | `toSubscriptionWithPlanResponse → id` | Aligned | |
| `UserSubscriptionSchema.userId` | `toSubscriptionWithPlanResponse → userId` | Aligned | |
| `UserSubscriptionSchema.planId` | `toSubscriptionWithPlanResponse → planId` | Aligned | |
| `UserSubscriptionSchema.status` | `toSubscriptionWithPlanResponse → status` | Aligned | `as SubscriptionStatus` cast |
| `UserSubscriptionSchema.currentPeriodEnd` | `toSubscriptionWithPlanResponse → currentPeriodEnd` | Aligned | `?.toISOString() ?? null` |
| `UserSubscriptionSchema.cancelAtPeriodEnd` | `toSubscriptionWithPlanResponse → cancelAtPeriodEnd` | Aligned | |
| `UserSubscriptionSchema.createdAt` | `toSubscriptionWithPlanResponse → createdAt` | Aligned | `.toISOString()` |
| `UserSubscriptionSchema.updatedAt` | `toSubscriptionWithPlanResponse → updatedAt` | Aligned | `.toISOString()` |
| `UserSubscriptionWithPlanSchema.plan` | `toSubscriptionWithPlanResponse → plan` | Aligned | Composed via `toPlanResponse(plan)` |

Return types are TS-enforced: `toPlanResponse` returns `SubscriptionPlan` (imported from `@snc/shared`), `toSubscriptionWithPlanResponse` returns `UserSubscriptionWithPlan` (imported from `@snc/shared`).

### Validation Sync

| Field | Server Rule | Client Rule | Status |
|-------|-------------|-------------|--------|
| `CheckoutRequestSchema.planId` | `z.string().min(1)` | No client-side schema — `pricing.tsx` passes `plan.id` from loader data | **N/A** — validated by Zod on server; client sends pre-loaded plan ID |
| `CancelRequestSchema.subscriptionId` | `z.string().min(1)` | No client-side schema — `subscriptions.tsx` passes `sub.id` from fetched data | **N/A** — validated by Zod on server; client sends pre-fetched ID |
| `PlansQuerySchema.creatorId` | `z.string().optional()` | `fetchPlans({ creatorId })` passes through as query param | Synced — optional on both sides |
| `PlansQuerySchema.type` | `PlanTypeSchema.optional()` (enum: "platform" \| "creator") | `fetchPlans({ type })` passes through as string | Synced — server validates enum, client sends known values |

No validation mismatches found. The subscription domain doesn't have user-editable form inputs with complex constraints — all mutations use IDs from previously-fetched data.

### Error Path Coverage

| Error | API Route | Web Component | UI Treatment |
|-------|-----------|---------------|--------------|
| `ValidationError("Plan not found or inactive")` | `subscription.routes.ts:185` (400) | `pricing.tsx` catch block | Shows `error.message` via `role="alert"` div |
| `STRIPE_ERROR` 502 (getOrCreateCustomer) | `subscription.routes.ts:190-192` | `pricing.tsx` catch block | Shows `error.message` via `role="alert"` div |
| `STRIPE_ERROR` 502 (createCheckoutSession) | `subscription.routes.ts:209-211` | `pricing.tsx` catch block | Shows `error.message` via `role="alert"` div |
| `NotFoundError("Subscription not found")` | `subscription.routes.ts:250` (404) | `subscriptions.tsx` catch block | Shows `error.message` via `role="alert"` div |
| `ForbiddenError("Not the subscription owner")` | `subscription.routes.ts:255` (403) | `subscriptions.tsx` catch block | Shows `error.message` via `role="alert"` div |
| `ValidationError("Subscription is not active")` | `subscription.routes.ts:260` (400) | `subscriptions.tsx` catch block | Shows `error.message` via `role="alert"` div |
| `ValidationError("...already set to cancel")` | `subscription.routes.ts:264` (400) | `subscriptions.tsx` catch block | Shows `error.message` via `role="alert"` div |
| `STRIPE_ERROR` 502 (cancelSubscriptionAtPeriodEnd) | `subscription.routes.ts:273-275` | `subscriptions.tsx` catch block | Shows `error.message` via `role="alert"` div |
| `BILLING_NOT_CONFIGURED` 503 | `stripe.ts:37-44` | All checkout/cancel paths | Shows generic Stripe error message |
| `WEBHOOK_SIGNATURE_ERROR` 400 | `webhook.routes.ts:208-210` | N/A (server-to-server) | N/A — webhook endpoint, no UI |
| `useSubscriptions` fetch error | N/A | `use-subscriptions.ts:28-31` | **Silently swallowed** — intentional (supplementary status) |
| `fetchMySubscriptions` error in settings page | `subscription.routes.ts:320` (401) | `subscriptions.tsx:39` | Shows "Failed to load subscriptions" — generic message, not specific error |

All user-facing errors from subscription routes have UI treatment. The `throwIfNotOk` in `fetch-utils.ts` extracts `error.message` from the structured JSON response, so Stripe error messages (from `wrapStripeError`) are properly relayed. The one gap is that `settings/subscriptions.tsx:39` uses a hardcoded "Failed to load subscriptions" instead of the actual error message for the initial fetch — minor since this is typically a network error.

### Type Chain

| Step | Type | Mechanism | Status |
|------|------|-----------|--------|
| Shared | `SubscriptionPlan` | `z.infer<typeof SubscriptionPlanSchema>` | Source of truth |
| Shared | `UserSubscriptionWithPlan` | `z.infer<typeof UserSubscriptionWithPlanSchema>` | Source of truth |
| API transformer | `toPlanResponse` returns `SubscriptionPlan` | Explicit return type annotation | TS-enforced |
| API transformer | `toSubscriptionWithPlanResponse` returns `UserSubscriptionWithPlan` | Explicit return type annotation | TS-enforced |
| Web lib | `fetchPlans` returns `SubscriptionPlan[]` | `apiGet<{ plans: SubscriptionPlan[] }>` | Generic matches shared type |
| Web lib | `fetchMySubscriptions` returns `UserSubscriptionWithPlan[]` | `apiGet<{ subscriptions: UserSubscriptionWithPlan[] }>` | Generic matches shared type |
| Web lib | `createCheckout` returns `string` | `apiMutate<{ checkoutUrl: string }>` | Matches `CheckoutResponseSchema` |
| Web lib | `cancelSubscription` returns `void` | `apiMutate<void>` | **Discards** `CancelResponseSchema` response (see P2.4) |
| Component | `PlanCard` props | `plan: SubscriptionPlan` | Typed via `@snc/shared` import |
| Component | `SubscriptionList` props | `subscriptions: readonly UserSubscriptionWithPlan[]` | Typed via `@snc/shared` import |
| Component | `SubscribeCta` props | `creatorId: string`, `contentType: ContentType` | Typed via `@snc/shared` import |
| Hook | `useSubscriptions` return | `readonly UserSubscriptionWithPlan[]` | Typed via `@snc/shared` import |
| Hook | `usePlatformAuth` return | `{ isAuthenticated: boolean; isSubscribed: boolean }` | Derived from session + subscription |

No `any` types found in the subscription data chain. No manual type re-definitions — all use `@snc/shared` types. The `as` casts in `ensureConfigured()` are the only type-safety gaps (see P1.2).

### Fixture Sync

| Entity | API Factory | Web Factory | Status | Notes |
|--------|-------------|-------------|--------|-------|
| Plan | `makeMockPlan` → `DbSubscriptionPlanRow` | `makeMockPlan` → `SubscriptionPlan` | Synced | API uses `Date` objects, web uses ISO strings. IDs, names, prices, types match. API has `stripePriceId` (DB-only field not in shared schema). |
| Subscription | `makeMockSubscription` → `DbUserSubscriptionRow` | `makeMockUserSubscription` → `UserSubscriptionWithPlan` | **Minor mismatch** | API `userId` default is `"user_test_xxx"`, web `userId` default is `"user-1"`. API has `stripeSubscriptionId`/`stripeCustomerId` (DB-only). Web fixture inlines nested `plan` object. |
| Webhook events | `makeCheckoutSessionCompletedEvent` etc. | N/A | N/A | Webhook fixtures are API-only (no web equivalent needed) |

The `userId` default mismatch (`"user_test_xxx"` vs `"user-1"`) is harmless — tests override with specific values when needed — but inconsistent with the `dual-layer-fixtures` pattern guideline that non-format defaults should match. The factory naming convention also differs: API uses `makeMockSubscription`, web uses `makeMockUserSubscription`.

### Dead API Surface

| API Response Field | Used By Web | Status |
|---|---|---|
| `SubscriptionPlan.id` | `PlanCard` (key + onSubscribe), `SubscribeCta`, pricing | Used |
| `SubscriptionPlan.name` | `PlanCard`, `SubscriptionList`, pricing | Used |
| `SubscriptionPlan.type` | `SubscriptionList` (planTypeLabel), `hasPlatformSubscription`, pricing filter | Used |
| `SubscriptionPlan.creatorId` | `SubscribeCta` (fetchPlans filter) | Used |
| `SubscriptionPlan.price` | `PlanCard` (formatPrice), `SubscriptionList`, `SubscribeCta` | Used |
| `SubscriptionPlan.interval` | `PlanCard` (formatInterval), `SubscriptionList`, `SubscribeCta` | Used |
| `SubscriptionPlan.active` | Not directly read by web components | **Dead surface** — always true (API filters active=true). Useful for admin UI in future. |
| `SubscriptionPlan.createdAt` | Not read by web components | **Dead surface** — returned but not displayed |
| `SubscriptionPlan.updatedAt` | Not read by web components | **Dead surface** — returned but not displayed |
| `UserSubscription.id` | `SubscriptionList` (key + onCancel) | Used |
| `UserSubscription.userId` | Not read by web components | **Dead surface** — user context is from session, not subscription |
| `UserSubscription.planId` | Not read by web components | **Dead surface** — plan accessed via nested `.plan` object |
| `UserSubscription.status` | `SubscriptionList`, `hasPlatformSubscription`, checkout success | Used |
| `UserSubscription.currentPeriodEnd` | `SubscriptionList` (formatDate for billing/cancel dates) | Used |
| `UserSubscription.cancelAtPeriodEnd` | `SubscriptionList` (status display + button disable) | Used |
| `UserSubscription.createdAt` | Not read by web components | **Dead surface** |
| `UserSubscription.updatedAt` | Not read by web components | **Dead surface** |

5 fields are returned but not read by any web component: `SubscriptionPlan.active`, `SubscriptionPlan.createdAt`, `SubscriptionPlan.updatedAt`, `UserSubscription.userId`, `UserSubscription.planId`, `UserSubscription.createdAt`, `UserSubscription.updatedAt`. These are standard audit/metadata fields that are low-cost to return and likely useful for admin or debugging. No action required, but noted for completeness.

---

## Suggested Implementation Order

1. **P1.2** — Eliminate `ensureConfigured()` `as` casts (smallest, zero-risk, unblocks P1.1)
2. **P1.1** — Extract shared Stripe client from `stripe.ts` and `revenue.ts` (highest duplication value)
3. **P1.3** — Add `ERROR_502`/`ERROR_503` to subscription route OpenAPI specs (quick, improves API docs)
4. **P2.1** — Consolidate `handleSubscribe` in `pricing.tsx` to use `useCheckout` hook
5. **P2.4** — Update `cancelSubscription` to return response data (eliminates extra fetch)
6. **P2.5** — Improve webhook event type cast (optional, low-risk)
7. **P2.2** / **P2.3** — `SubscribeCta` improvements (lower priority, evaluate overhead)

Order by: dependencies first (P1.2 before P1.1) → highest value (P1.1) → least risk (P1.3, P2.1).
