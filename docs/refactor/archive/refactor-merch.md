> **Archived**: 2026-03-09
> **Validation**: All tests passing, no cross-finding regressions

# Refactor Analysis: Merch (Shopify Storefront Integration)

> **Generated**: 2026-03-09
> **Scope**: 23 files analyzed across all layers (shared schema, API service + routes, web lib + components + routes, all tests and fixtures)
> **Libraries researched**: Shopify Storefront API (v2025-01), Hono v4.12, hono-openapi v1.2, Vitest v4, Zod v4.3, @shopify/storefront-api-client v1.0

---

## Executive Summary

The merch vertical slice is well-structured with good pattern compliance across layers. The analysis found 13 findings: 1 P0 (deprecated Shopify API query), 3 P1 (GraphQL fragment deduplication, missing checkout error feedback, missing lib test coverage), 5 P2 (type chain gaps, banner CSS consolidation, API version management, cart warnings support, `as` cast inconsistency), and 4 P3 (minor style and consistency improvements). All existing patterns are followed correctly; the main risk is the deprecated `productByHandle` Shopify query.

---

## P0 -- Fix Now

### Deprecated `productByHandle` Shopify Query
- **Location**: `apps/api/src/services/shopify.ts:191-233`
- **Issue**: The `PRODUCT_BY_HANDLE_QUERY` uses the `productByHandle` query root field, which Shopify has deprecated across all Storefront API versions (including 2025-01). The recommended replacement is the `product(handle: $handle)` query.
- **Risk**: Shopify may remove `productByHandle` in a future API version (stable versions are supported for 12 months minimum). When removed, all product detail pages will break with a GraphQL error.
- **Fix**: Replace `productByHandle(handle: $handle)` with `product(handle: $handle)` in the `PRODUCT_BY_HANDLE_QUERY` string. Update the `ProductByHandleData` response type to use `product` instead of `productByHandle` as the root field name. Update `getProductByHandle` to read `result.value.product` instead of `result.value.productByHandle`.
- **Verify**: [x] Tests pass without modification / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P1 -- High Value

### GraphQL Product Field Selection Duplication
- **Affected files**: `apps/api/src/services/shopify.ts:138-233`
- **Current state**: `PRODUCTS_QUERY` and `PRODUCT_BY_HANDLE_QUERY` contain identical field selections for the product node (id, handle, title, description, vendor, tags, featuredImage, images, priceRange, variants) -- approximately 30 lines of duplicated GraphQL text.
- **Proposed consolidation**: Extract a `PRODUCT_FIELDS_FRAGMENT` GraphQL fragment (`fragment ProductFields on Product { ... }`) and reference it via `...ProductFields` in both queries. This eliminates the duplication and ensures field selections stay in sync.
- **Estimated scope**: 1 file changed, ~25 LOC removed (net), 0 test changes (tests mock at the service function level, not the query string level)
- **Pattern reference**: `route-private-helpers` (intra-file deduplication)
- **Tests affected**: None -- `shopify.test.ts` mocks `fetch` responses, not query strings
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### Missing User-Visible Error Feedback on Checkout Failure
- **Affected files**: `apps/web/src/components/merch/product-detail.tsx:46-55`
- **Current state**: The `handleBuy` function's `catch` block only resets `isCheckingOut` to `false`. There is no `setError` state, no user-visible error message, and no `onError` callback. If `createMerchCheckout` fails (network error, Shopify 502, etc.), the button silently resets to "Buy" with no feedback. Compare with the subscription checkout flow: `use-checkout.ts` accepts an `onError` callback that surfaces the error message to the user.
- **Proposed consolidation**: Add an `error` state to `ProductDetail`. In the `catch` block, extract the error message and set it. Render the error below the Buy button using the shared `error-alert.module.css`. This mirrors the established `useCheckout` pattern.
- **Estimated scope**: 1 component file (~8 LOC added), 1 test file (add error-state test)
- **Pattern reference**: `zod-mini-form-validation` (error state display pattern), `css-modules-design-tokens` (shared alert CSS)
- **Tests affected**: `apps/web/tests/unit/components/product-detail.test.tsx` -- add test for error display on checkout failure
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### Missing `lib/merch.ts` Unit Tests
- **Affected files**: `apps/web/src/lib/merch.ts` (no corresponding test file)
- **Current state**: Every other domain lib module with API calls has a test file (`booking.test.ts`, `dashboard.test.ts`, `creator.test.ts`). The merch lib has three exported functions (`fetchProducts`, `fetchProductByHandle`, `createMerchCheckout`) but no unit tests verifying they construct the correct URL, pass parameters via `apiGet`/`apiMutate`, or extract the checkout URL from the response.
- **Proposed consolidation**: Create `apps/web/tests/unit/lib/merch.test.ts` following the same pattern as `booking.test.ts` (mock `fetch-utils.js`, verify URL construction and parameter passing for each exported function).
- **Estimated scope**: 1 new test file (~80-100 LOC)
- **Pattern reference**: `web-fetch-client` (lib modules consuming `apiGet`/`apiMutate`)
- **Tests affected**: New file only
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P2 -- Medium Value

### `createMerchCheckout` Type Chain Gap
- **Location**: `apps/web/src/lib/merch.ts:42`
- **Affected files**: `apps/web/src/lib/merch.ts`
- **Issue**: `createMerchCheckout` uses `apiMutate<{ checkoutUrl: string }>` with an inline type literal instead of importing `MerchCheckoutResponse` from `@snc/shared`. All other lib functions in this file (`fetchProducts`, `fetchProductByHandle`) correctly reference shared types. This creates a drift risk if the response shape changes in the shared schema.
- **Suggestion**: Change to `apiMutate<MerchCheckoutResponse>` and extract `.checkoutUrl` from the result, or use `apiMutate<{ checkoutUrl: string }>` but import `MerchCheckoutResponse` and use it as the generic parameter.
- **Tests affected**: None
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### Banner CSS Could Use Shared Alert Modules
- **Location**: `apps/web/src/routes/merch/merch-index.module.css:11-29`
- **Affected files**: `apps/web/src/routes/merch/merch-index.module.css`, `apps/web/src/routes/merch/index.tsx`
- **Issue**: The `.banner` (success) and `.bannerInfo` (cancel) CSS classes in `merch-index.module.css` duplicate the pattern used by `success-alert.module.css` and `error-alert.module.css` (shared alert modules used by 7 other pages). The merch banners have slightly different styling (centered text, `--color-accent` for success instead of `--color-success`, `--color-border` for info instead of `--color-error`), so they are not exact duplicates, but the structural pattern is the same.
- **Suggestion**: Evaluate whether merch banners should adopt `success-alert.module.css` for consistency. The accent color choice may be intentional (merch success is an order confirmation, not a settings save), but the info/cancel banner could align with a shared info-alert style. At minimum, document the design intent if the deviation is intentional.
- **Tests affected**: None (CSS-only change)
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09 — Success banner adopted `success-alert.module.css`; info/cancel banner kept as local `.bannerInfo` (neutral styling is semantically correct for a non-error informational message; no shared info-alert module exists)

### Shopify API Version Hardcoded as Magic String
- **Location**: `apps/api/src/services/shopify.ts:59`
- **Affected files**: `apps/api/src/services/shopify.ts`, `apps/api/src/config.ts` (potential)
- **Issue**: `STOREFRONT_API_VERSION = "2025-01"` is a module-level constant. While this is acceptable, moving it to `config.ts` or making it an env var would allow version bumps without code changes. The current version (2025-01) is already behind the latest stable releases (2025-04, 2025-07, 2025-10). Upgrading enables new features like cart `warnings` field and consent directives.
- **Suggestion**: Either (a) upgrade to `2025-10` or later to get cart warnings support, or (b) add `SHOPIFY_API_VERSION` to `config.ts` as an optional env var with `"2025-01"` as default. Option (a) is simpler for now.
- **Tests affected**: `apps/api/tests/services/shopify.test.ts` -- update endpoint URL assertion
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### Cart Mutation Missing `warnings` Field
- **Location**: `apps/api/src/services/shopify.ts:235-247`
- **Affected files**: `apps/api/src/services/shopify.ts`
- **Issue**: The `CART_CREATE_MUTATION` does not request the `warnings` field added in Storefront API 2024-10. As of 2024-10+, inventory-related errors (out of stock, insufficient stock) are no longer returned in `userErrors` and are instead returned in `warnings`. If the API version is upgraded past 2024-10 without adding `warnings` to the mutation, inventory failures will be silently swallowed.
- **Suggestion**: Add `warnings { code message }` to the `CART_CREATE_MUTATION` response selection. Update `CartCreateData` type to include `warnings`. Check `warnings` in `createCheckoutUrl` and return an appropriate error if inventory warnings are present.
- **Tests affected**: `apps/api/tests/services/shopify.test.ts` -- add test for cart warnings
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### Inconsistent `fetchApiServer` Cast Pattern in Merch Detail Loader
- **Location**: `apps/web/src/routes/merch/$handle.tsx:13-15`
- **Affected files**: `apps/web/src/routes/merch/$handle.tsx`
- **Issue**: Uses `await (fetchApiServer({...}) as Promise<MerchProductDetail>)` while all other routes use `(await fetchApiServer({...})) as MerchProductDetail`. Both are functionally equivalent and type-safe, but the inconsistency makes the codebase harder to grep and maintain.
- **Suggestion**: Change to `(await fetchApiServer({ data: ... })) as MerchProductDetail` to match the convention used in all other loaders.
- **Tests affected**: None
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P3 -- Nice-to-Have

- **`imagePlaceholder` gradient duplicated**: `product-card.module.css:38-43` and `product-detail.module.css:40-46` define identical placeholder gradient styles. Could extract to a shared CSS module if the pattern appears in more components. Currently only 2 occurrences within the same domain, so extraction is optional. (`apps/web/src/components/merch/product-card.module.css`, `apps/web/src/components/merch/product-detail.module.css`)
- **`creatorLink` rendering duplicated in ProductCard and ProductDetail**: Both components contain identical conditional rendering logic (~12 lines) for the creator name + link pattern. Could extract to a `CreatorAttribution` micro-component if the pattern expands. Currently 2 occurrences within the same domain. (`apps/web/src/components/merch/product-card.tsx:38-53`, `apps/web/src/components/merch/product-detail.tsx:102-117`)
- **`vendor || null` nullish coalescing**: `apps/api/src/routes/merch.routes.ts:50` uses `node.vendor || null` which treats empty string as null. This is likely intentional (empty vendor = no creator name), but `?? null` would be more idiomatic if the intent is only to catch `undefined`/`null`. Verify that Shopify always returns a string (never `undefined`).
- **`product-detail.module.css` uses `--font-size-2xl` and `--font-size-xl`**: Verify these tokens are defined in `global.css`. They are not shown in the pattern doc's `global.css` excerpt but may have been added later. (`apps/web/src/components/merch/product-detail.module.css:92,98`)

---

## Skip -- Intentional Patterns

| Pattern | Location | Why it stays |
|---------|----------|-------------|
| `toMerchProduct` / `toMerchProductDetail` as route-private transformers | `merch.routes.ts:45-68` | Per `row-to-response-transformer` pattern: transformers are private to their route file. These transform Shopify GraphQL nodes (not DB rows), but the same principle applies. |
| Separate API and web fixture factories | `api/tests/helpers/merch-fixtures.ts`, `web/tests/helpers/merch-fixtures.ts` | Per `dual-layer-fixtures` pattern. Note: merch is unusual in that both layers use the same response shape (no Date/string conversion needed since Shopify returns strings). The factories are still correctly separated for layer independence. |
| `priceToCents` / `extractCreatorId` as route-private helpers | `merch.routes.ts:37-43` | Per `route-private-helpers` pattern: these are used by multiple handlers in the same file and are not exported. |
| `MerchProduct` uses `price: number` (cents) while Shopify returns decimal strings | `packages/shared/src/merch.ts:24` | Deliberate normalization: the API route converts Shopify's `"25.00"` to `2500` cents via `priceToCents`. All price handling in the codebase uses integer cents (see `formatPrice` in `lib/format.ts`). |
| `wrapShopifyError` specialization via factory | `shopify.ts:71` | Per `external-error-factory` pattern: module-scope specialization of `wrapExternalError("SHOPIFY_ERROR")`. |
| `ensureConfigured()` returns `Result<void, AppError>` | `shopify.ts:73-84` | Per `result-type` pattern: predictable failure path (missing config) returned as Result, not thrown. |
| No `zValidator` on GET `/:handle` route | `merch.routes.ts:143` | Path params are inherently strings; Hono provides them directly. No schema validation needed for a free-form product handle. |

---

## Cross-Layer Continuity

### Schema-Transformer Alignment

| Shared Schema | Transformer | Status | Notes |
|---------------|-------------|--------|-------|
| `MerchProductSchema.handle` | `toMerchProduct -> handle` | Aligned | Direct passthrough from Shopify node |
| `MerchProductSchema.title` | `toMerchProduct -> title` | Aligned | Direct passthrough |
| `MerchProductSchema.price` | `toMerchProduct -> priceToCents(...)` | Aligned | Converted from decimal string to integer cents |
| `MerchProductSchema.image` | `toMerchProduct -> featuredImage` | Aligned | Direct passthrough (Shopify shape matches MerchImage) |
| `MerchProductSchema.creatorName` | `toMerchProduct -> vendor \|\| null` | Aligned | Maps vendor to creatorName |
| `MerchProductSchema.creatorId` | `toMerchProduct -> extractCreatorId(tags)` | Aligned | Extracted from Shopify tags |
| `MerchProductDetailSchema.description` | `toMerchProductDetail -> description` | Aligned | Direct passthrough |
| `MerchProductDetailSchema.images` | `toMerchProductDetail -> images.edges.map(e => e.node)` | Aligned | Flattened from edges |
| `MerchProductDetailSchema.variants` | `toMerchProductDetail -> variants.edges.map(...)` | Aligned | Flattened + transformed (availableForSale -> available, price string -> cents) |

### Validation Sync

| Field | Server Rule | Client Rule | Status |
|-------|-------------|-------------|--------|
| `variantId` | `z.string().min(1)` via `MerchCheckoutRequestSchema` | Not validated client-side (passed directly from variant.id) | **Acceptable** -- variant IDs come from API data, not user input |
| `quantity` | `z.coerce.number().int().min(1).max(10).default(1)` | Hardcoded `1` in `ProductDetail.handleBuy` | **Acceptable** -- quantity is not user-configurable in current UI |
| `limit` | `z.coerce.number().int().min(1).max(50).default(12)` | Hardcoded `12` in `buildMerchUrl` | **Synced** -- client always sends valid value |
| `creatorId` | `z.string().optional()` | Passed from URL search params | **Synced** |
| `cursor` | `z.string().optional()` | Passed from `useCursorPagination` | **Synced** |

### Error Path Coverage

| Error | API Route | Web Component | UI Treatment |
|-------|-----------|---------------|--------------|
| `NotFoundError` (product not found) | `merch.routes.ts:150` | `merch/$handle.tsx` loader catch | Redirects to `/merch` |
| `MERCH_NOT_CONFIGURED` (503) | `merch.routes.ts:111` | `merch/index.tsx` | Shows "Merch coming soon." |
| `SHOPIFY_ERROR` (502) | `merch.routes.ts:111` | `merch/index.tsx` | Shows "Merch coming soon." (same as 503) |
| `SHOPIFY_ERROR` (checkout 502) | `merch.routes.ts:184` | `product-detail.tsx:52` | **No UI treatment** -- button resets silently |
| `ValidationError` (400, bad request) | `merch.routes.ts:92` | N/A | Standard error handler; unlikely from valid UI |

### Type Chain

| Step | Type | Mechanism | Status |
|------|------|-----------|--------|
| Shared | `MerchProduct`, `MerchProductDetail` | Zod `.infer` | Source of truth |
| Transformer | `toMerchProduct`, `toMerchProductDetail` | Returns `MerchProduct`, `MerchProductDetail` | TS-enforced via return type annotation |
| Web lib | `apiGet<MerchListResponse>`, `apiGet<MerchProductDetail>` | Generic parameter | Matches shared types |
| Web lib | `apiMutate<{ checkoutUrl: string }>` | Inline type literal | **Drift risk** -- should reference `MerchCheckoutResponse` |
| Component | `ProductCard`, `ProductDetail` | Props typed as shared types | Matches shared |
| Loader | `fetchApiServer({...}) as Promise<MerchProductDetail>` | Cast | Matches shared |

### Fixture Sync

| Entity | API Factory | Web Factory | Status | Notes |
|--------|-------------|-------------|--------|-------|
| MerchProduct | `makeMockProduct` | `makeMockMerchProduct` | Synced | Same field values; naming convention differs (web prefixes `Merch`) |
| MerchProductDetail | `makeMockProductDetail` | `makeMockMerchProductDetail` | **Minor diff** | API fixture description: "...for unit testing." vs web: "A high-quality test t-shirt." -- cosmetic only |
| MerchVariant | `makeMockVariant` | (inlined in `makeMockMerchProductDetail`) | Synced | Web inlines variants; API has separate factory. Both use same default values. |
| ShopifyProductNode | `makeMockShopifyProductNode` | N/A | N/A | API-only fixture for Shopify GraphQL mocking |

---

## Best Practices Research

### Shopify Storefront API v2025-01

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `productByHandle` query | `product(handle: $handle)` query | Low -- rename query field + update response type |
| API version `2025-01` hardcoded | Upgrade to `2025-10` or `2026-01` for cart warnings + consent | Low -- change version string, add `warnings` field |
| No cart `warnings` field | Request `warnings { code message }` in cartCreate | Low -- add field + handle in response |
| Hand-rolled GraphQL fetch | Continue hand-rolled (see OSS Alternatives below) | N/A |

### Hono v4.12 + hono-openapi v1.2

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `validator("query", ...)` with `c.req.valid("query" as never) as T` cast | `c.req.valid("query")` should work without cast in hono-openapi v1.2+ | Low -- remove `as never` cast if types resolve |
| Shared `ERROR_4xx` constants from `openapi-errors.ts` | Already best practice per hono-openapi docs | N/A |

---

## OSS Alternatives

| Hand-rolled Code | Package | Weekly DL | Stack Fit | Notes |
|-----------------|---------|-----------|-----------|-------|
| GraphQL fetch wrapper in `shopify.ts` (~50 LOC) | `@shopify/storefront-api-client` | ~29K | Partial | Official Shopify client. Adds automatic API versioning, retry logic, and type generation. However, current hand-rolled approach is thin (~50 LOC), well-tested (22 tests), and follows established patterns (`external-error-factory`, `result-type`). Migration would require adapting error handling to the Result pattern. **Recommendation: keep hand-rolled** -- the official client adds complexity without proportional benefit at current scale. |

---

## Pattern Compliance

| Pattern | Status | Notes |
|---------|--------|-------|
| `row-to-response-transformer` | Compliant | `toMerchProduct`/`toMerchProductDetail` transform Shopify nodes (analogous to DB rows); return types reference shared types |
| `route-private-helpers` | Compliant | `priceToCents`, `extractCreatorId` are unexported private helpers |
| `external-error-factory` | Compliant | `wrapShopifyError = wrapExternalError("SHOPIFY_ERROR")` |
| `result-type` | Compliant | All Shopify service functions return `Result<T, AppError>` |
| `cursor-encode-decode` | Compliant | Uses `encodeCursor`/`decodeRawCursor` (the raw variant for opaque Shopify cursors) |
| `web-fetch-client` | Compliant | `lib/merch.ts` uses `apiGet`/`apiMutate` from `fetch-utils.ts` |
| `css-modules-design-tokens` | Compliant | All CSS modules use `var(--token)` exclusively |
| `listing-page-shared-css` | Compliant | `merch/index.tsx` imports `listingStyles` from shared module |
| `vi-hoisted-module-mock` | Compliant | Component tests use `vi.hoisted()` + `vi.mock()` correctly |
| `dual-layer-fixtures` | Compliant | Separate API and web fixture files with correct shapes |
| `use-cursor-pagination` | Compliant | `merch/index.tsx` uses hook with `buildUrl` + `deps` |
| `hono-test-app-factory` | Compliant | Route tests use `setupRouteTest` factory |
| `shared-validation-constants` | N/A | Merch has no client-side validation requiring shared constants |
| `tanstack-file-route` | Compliant | Both merch routes export `Route = createFileRoute(...)` with appropriate loaders |
| `app-error-hierarchy` | Compliant | Uses `NotFoundError`, `AppError` with correct codes and status codes |

---

## Suggested Implementation Order

1. **P0: Replace `productByHandle` with `product` query** -- Immediate; prevents future breakage from Shopify deprecation
2. **P1: Extract GraphQL fragment** -- Do alongside P0 since both modify the same file
3. **P1: Add checkout error feedback** -- Low-effort UX improvement
4. **P2: Fix `createMerchCheckout` type chain** -- Quick fix while reviewing lib
5. **P2: Upgrade Shopify API version + add cart warnings** -- Do after P0 to avoid two separate query changes
6. **P2: Normalize `fetchApiServer` cast pattern** -- Trivial consistency fix
7. **P1: Add `lib/merch.test.ts`** -- Can be done independently anytime
8. **P2: Evaluate banner CSS consolidation** -- Do when touching merch page styles
