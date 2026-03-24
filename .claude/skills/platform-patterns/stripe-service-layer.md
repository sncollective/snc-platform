# Pattern: Stripe Service Layer

Thin wrapper around the Stripe SDK that isolates all payment API calls behind a `getStripe()` factory (making Stripe optional), with `wrapStripeErrorGranular()` for type-aware HTTP status mapping and all exports returning `Result<T, AppError>`.

## Rationale

Stripe errors must never propagate unhandled into route handlers. Isolating all Stripe calls in a service module enforces the `Result<T, AppError>` contract, maps Stripe exceptions to typed `AppError` subclasses with appropriate HTTP status codes, and makes the entire payment layer replaceable in tests via `vi.doMock("../../src/services/stripe.js", ...)`. The `getStripe()` factory returns `Result<Stripe, AppError>` so Stripe is optional — when not configured, service functions return `BILLING_NOT_CONFIGURED` (503) instead of crashing at startup.

## Examples

### Example 1: Lazy singleton factory in stripe-client.ts
**File**: `apps/api/src/services/stripe-client.ts`
```typescript
import Stripe from "stripe";
import { AppError, ok, err, type Result } from "@snc/shared";
import { config } from "../config.js";

const STRIPE_KEY: string | null = config.STRIPE_SECRET_KEY ?? null;
let stripeInstance: Stripe | null = null;

export const getStripe = (): Result<Stripe, AppError> => {
  if (STRIPE_KEY === null) {
    return err(
      new AppError("BILLING_NOT_CONFIGURED", "Stripe integration is not configured", 503),
    );
  }
  if (stripeInstance === null) {
    stripeInstance = new Stripe(STRIPE_KEY);
  }
  return ok(stripeInstance);
};
```

### Example 2: Granular error wrapper in external-error.ts
**File**: `apps/api/src/services/external-error.ts:22`
```typescript
/** Maps Stripe SDK error subclasses to appropriate HTTP statuses. */
export const wrapStripeErrorGranular = (e: unknown): AppError => {
  if (e instanceof Stripe.errors.StripeCardError)
    return new AppError("STRIPE_CARD_ERROR", e.message, 400);
  if (e instanceof Stripe.errors.StripeInvalidRequestError)
    return new AppError("STRIPE_INVALID_REQUEST", e.message, 400);
  if (e instanceof Stripe.errors.StripeRateLimitError)
    return new AppError("STRIPE_RATE_LIMIT", e.message, 429);
  if (e instanceof Stripe.errors.StripeAuthenticationError)
    return new AppError("STRIPE_AUTH_ERROR", e.message, 500);
  if (e instanceof Stripe.errors.StripeConnectionError)
    return new AppError("STRIPE_CONNECTION_ERROR", e.message, 502);
  if (e instanceof Stripe.errors.StripeAPIError)
    return new AppError("STRIPE_API_ERROR", e.message, 502);
  return new AppError("STRIPE_ERROR", e instanceof Error ? e.message : String(e), 502);
};
```

### Example 3: Service function using getStripe() + wrapStripeErrorGranular
**File**: `apps/api/src/services/stripe.ts:28`
```typescript
export const getOrCreateCustomer = async (
  userId: string,
  email: string,
): Promise<Result<string, AppError>> => {
  const stripeResult = getStripe();
  if (!stripeResult.ok) return err(stripeResult.error);
  const stripe = stripeResult.value;

  try {
    const search = await stripe.customers.search({
      query: `metadata["sncUserId"]:"${userId}"`,
    });
    const [first] = search.data;
    if (first !== undefined) return ok(first.id);

    const customer = await stripe.customers.create({
      email,
      metadata: { sncUserId: userId },
    });
    return ok(customer.id);
  } catch (e) {
    return err(wrapStripeErrorGranular(e));
  }
};
```

### Example 4: Routes consume the service layer via Result checks
**File**: `apps/api/src/routes/subscription.routes.ts`
```typescript
const customerResult = await getOrCreateCustomer(user.id, user.email);
if (!customerResult.ok) {
  throw customerResult.error;  // AppError caught by errorHandler middleware
}

const sessionResult = await createCheckoutSession({
  customerId: customerResult.value,
  planStripePriceId: plan.stripePriceId,
  userId: user.id,
  planId: plan.id,
  successUrl,
  cancelUrl,
});
if (!sessionResult.ok) {
  throw sessionResult.error;
}
return c.json({ checkoutUrl: sessionResult.value });
```

### Example 5: Service layer mocked wholesale in tests
**File**: `apps/api/tests/routes/subscription.routes.test.ts`
```typescript
vi.doMock("../../src/services/stripe.js", () => ({
  getOrCreateCustomer: mockGetOrCreateCustomer,
  createCheckoutSession: mockCreateCheckoutSession,
  cancelSubscriptionAtPeriodEnd: mockCancelSubscriptionAtPeriodEnd,
}));
```

## When to Use
- Any call to an external payment API (Stripe checkout, customers, subscriptions)
- Webhook signature verification (synchronous but still returns `Result`)
- Anytime you need to isolate Stripe-specific error codes from route business logic

## When NOT to Use
- Pure Stripe type imports — those can be imported directly anywhere
- DB operations related to subscriptions — those belong in route handlers or separate DB helpers

## Common Violations
- Calling `new Stripe(key)` directly instead of `getStripe()`: bypasses the optional-Stripe pattern and crashes when Stripe isn't configured
- Throwing `new Error(...)` from a Stripe catch block instead of `wrapStripeErrorGranular()`: loses the typed `AppError` code and HTTP status differentiation
- Using blanket `STRIPE_ERROR` code for all failures: `wrapStripeErrorGranular` distinguishes card errors (400), rate limits (429), connection errors (502), etc.
- Using `STRIPE_ERROR` code for signature failures: use `WEBHOOK_SIGNATURE_ERROR` (400) to distinguish from upstream API errors (502)
- Calling `stripe.*` directly in a route handler: bypasses the Result contract and makes testing harder
