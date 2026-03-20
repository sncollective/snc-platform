# Pattern: Stripe Service Layer

Thin wrapper around the Stripe SDK that isolates all payment API calls in a single module, with a private `wrapStripeError()` helper and all exports returning `Result<T, AppError>`.

## Rationale

Stripe errors must never propagate unhandled into route handlers. Isolating all Stripe calls in a service module enforces the `Result<T, AppError>` contract, maps Stripe exceptions to typed `AppError` subclasses, and makes the entire payment layer replaceable in tests via `vi.doMock("../../src/services/stripe.js", ...)`.

## Examples

### Example 1: Module-level singleton + private error wrapper via factory
**File**: `apps/api/src/services/stripe.ts:20`
```typescript
import { wrapExternalError } from "./external-error.js";

// Module-level singleton initialized once at import time
const stripe = new Stripe(config.STRIPE_SECRET_KEY);

// Private helper via shared factory (see external-error-factory pattern):
const wrapStripeError = wrapExternalError("STRIPE_ERROR");
```

### Example 2: Service function wrapping a Stripe API call
**File**: `apps/api/src/services/stripe.ts:39`
```typescript
export const getOrCreateCustomer = async (
  userId: string,
  email: string,
): Promise<Result<string, AppError>> => {
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
    return err(wrapStripeError(e));
  }
};
```

### Example 3: Synchronous verification wrapped in Result
**File**: `apps/api/src/services/stripe.ts:118`
```typescript
// verifyWebhookSignature is synchronous — constructEvent does not return a Promise
export const verifyWebhookSignature = (
  rawBody: string,
  signature: string,
): Result<Stripe.Event, AppError> => {
  try {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.STRIPE_WEBHOOK_SECRET,
    );
    return ok(event);
  } catch (e) {
    return err(
      new AppError(
        "WEBHOOK_SIGNATURE_ERROR",
        e instanceof Error ? e.message : String(e),
        400,  // 400 for invalid signature, not 502
      ),
    );
  }
};
```

### Example 4: Routes consume the service layer via Result checks
**File**: `apps/api/src/routes/subscription.routes.ts:194`
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
**File**: `apps/api/tests/routes/subscription.routes.test.ts:65`
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
- Throwing `new Error(...)` from a Stripe catch block instead of `wrapStripeError()`: loses the typed `AppError` code and HTTP status
- Calling `stripe.*` directly in a route handler: bypasses the Result contract and makes testing harder
- Using `STRIPE_ERROR` code for signature failures: use `WEBHOOK_SIGNATURE_ERROR` (400) to distinguish from upstream API errors (502)
