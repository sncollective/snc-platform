# Pattern: External Error Factory

Curried factory `wrapExternalError(code)` produces a typed converter `(e: unknown) => AppError` for each external service; both Stripe and Shopify import and specialize it at module scope.

## Rationale

Every external service needs to convert unknown exceptions (network failures, SDK errors, etc.) to a typed `AppError` with a default HTTP status of 502. Rather than duplicating the conversion logic, a single factory captures the error code at call time and returns a reusable converter. New service modules get a one-liner setup. For services where different error types need different HTTP statuses (e.g., Stripe card errors → 400, rate limits → 429), use a granular variant instead (see `stripe-service-layer` pattern).

## Examples

### Example 1: Factory definition
**File**: `apps/api/src/services/external-error.ts:9`
```typescript
export const wrapExternalError =
  (code: string) =>
  (e: unknown): AppError =>
    new AppError(code, e instanceof Error ? e.message : String(e), 502);
```

### Example 2: Owncast service specializes the factory
**File**: `apps/api/src/services/owncast.ts:21`
```typescript
import { wrapExternalError } from "./external-error.js";

const wrapOwncastError = wrapExternalError("OWNCAST_ERROR");

// Used in every catch block:
} catch (e) {
  return err(wrapOwncastError(e));
}
```

### Example 3: Shopify service specializes the factory
**File**: `apps/api/src/services/shopify.ts:71`
```typescript
import { wrapExternalError } from "./external-error.js";

const wrapShopifyError = wrapExternalError("SHOPIFY_ERROR");

// Applied at the generic query executor's catch boundary:
} catch (e) {
  return err(wrapShopifyError(e));
}
```

## When to Use
- Adding any new external service module (third-party API, payment processor, CDN, etc.)
- Wrapping unknown exceptions at the catch boundary of an external API call
- Maintaining a default `AppError` code + 502 status for upstream failures where granular error mapping isn't needed

## When NOT to Use
- **Stripe errors** — use `wrapStripeErrorGranular` from `external-error.ts` which maps Stripe SDK error subclasses to specific HTTP statuses (400 for card/request errors, 429 for rate limits, 502 for connection errors). See [stripe-service-layer.md](stripe-service-layer.md).
- **Webhook signature failures** — those are 400 errors (client-sent bad signature), not 502 upstream failures; throw a manual `AppError` with `WEBHOOK_SIGNATURE_ERROR` and status 400
- **Internal logic errors** — use typed `AppError` subclasses directly (`NotFoundError`, `ForbiddenError`, etc.)

## Common Violations
- Inlining `new AppError("SHOPIFY_ERROR", ..., 502)` in multiple catch blocks instead of using the factory: code duplication and risk of inconsistent status codes
- Using the factory for non-502 errors: the factory always produces 502; for other status codes, construct `AppError` directly
