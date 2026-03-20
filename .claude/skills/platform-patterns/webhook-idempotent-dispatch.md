# Pattern: Webhook Idempotent Dispatch

Stripe webhook endpoint verifies signature via the service layer, deduplicates via an INSERT-on-unique-constraint check, then dispatches to per-event handler functions through a `Record<string, handler | undefined>` map; unknown events are silently acknowledged.

## Rationale

Stripe can deliver the same event multiple times. The `paymentEvents` table acts as a deduplication log: a successful INSERT means "first time seen"; a `duplicate key` exception means "already processed — return 200 immediately." The event dispatch map centralises routing without a switch statement and lets unknown events pass through without error. Each handler receives a loosely-typed `Record<string, unknown>` extracted from the verified event object.

## Examples

### Example 1: 4-step webhook processing flow
**File**: `apps/api/src/routes/webhook.routes.ts:201`
```typescript
webhookRoutes.post("/stripe", describeRoute({...}), async (c) => {
  // Step 1: Read raw body for signature verification
  const rawBody = await c.req.text();
  const signature = c.req.header("stripe-signature") ?? "";

  // Step 2: Verify signature via service layer (synchronous, returns Result)
  const verifyResult = verifyWebhookSignature(rawBody, signature);
  if (!verifyResult.ok) {
    throw verifyResult.error;  // → 400 WEBHOOK_SIGNATURE_ERROR
  }

  const event = verifyResult.value as unknown as StripeEventData;

  // Step 3: Idempotency check — INSERT event ID (PK) into dedup table
  try {
    await db.insert(paymentEvents).values({ id: event.id, type: event.type });
  } catch (e) {
    if (e instanceof Error && e.message.includes("duplicate key")) {
      return c.json({ received: true as const });  // Already processed — 200 OK
    }
    throw e;  // Unexpected DB error — re-throw
  }

  // Step 4: Dispatch to per-event handler (unknown types silently pass)
  const handler = EVENT_HANDLERS[event.type];
  if (handler) {
    await handler(event.data.object as Record<string, unknown>);
  }

  return c.json({ received: true as const });
});
```

### Example 2: Event dispatch map — `Record<string, handler | undefined>`
**File**: `apps/api/src/routes/webhook.routes.ts:171`
```typescript
const EVENT_HANDLERS: Record<
  string,
  ((data: Record<string, unknown>) => Promise<void>) | undefined
> = {
  "checkout.session.completed": handleCheckoutCompleted,
  "invoice.paid": handleInvoicePaid,
  "invoice.payment_failed": handlePaymentFailed,
  "customer.subscription.updated": handleSubscriptionUpdated,
  "customer.subscription.deleted": handleSubscriptionDeleted,
};
```

### Example 3: Private handler extracting fields with optional-chain guards
**File**: `apps/api/src/routes/webhook.routes.ts:47`
```typescript
const handleCheckoutCompleted = async (
  data: Record<string, unknown>,
): Promise<void> => {
  const metadata = data.metadata as { userId?: string; planId?: string } | undefined;
  const userId = metadata?.userId;
  const planId = metadata?.planId;
  const stripeSubscriptionId = data.subscription as string | undefined;
  const stripeCustomerId = data.customer as string | undefined;

  if (!userId || !planId || !stripeSubscriptionId || !stripeCustomerId) {
    console.error("checkout.session.completed missing required fields:", {
      userId, planId, stripeSubscriptionId, stripeCustomerId,
    });
    return;  // Silent drop — do NOT throw; Stripe retries on non-200
  }

  await db.insert(userSubscriptions).values({
    id: `sub_${node_crypto.randomUUID()}`,
    userId, planId, stripeSubscriptionId, stripeCustomerId,
    status: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false,
  });
};
```

### Example 4: Tests verify idempotency by simulating duplicate-key error
**File**: `apps/api/tests/routes/webhook.routes.test.ts:188`
```typescript
it("returns 200 for duplicate event ID (already processed)", async () => {
  mockInsertValues.mockRejectedValue(
    new Error('duplicate key value violates unique constraint "payment_events_pkey"'),
  );

  const res = await postWebhook(app, JSON.stringify(makeCheckoutSessionCompletedEvent()));
  const body = await res.json();

  expect(res.status).toBe(200);
  expect(body.received).toBe(true);
});
```

### Example 5: Deduplication table schema (unique PK = Stripe event ID)
**File**: `apps/api/src/db/schema/subscription.schema.ts:65`
```typescript
export const paymentEvents = pgTable("payment_events", {
  id: text("id").primaryKey(),   // Stripe event ID — unique by design
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

## When to Use
- Any endpoint that receives Stripe (or other payment provider) webhooks
- Any event-driven system where the same event may be delivered more than once

## When NOT to Use
- Inbound webhooks from fully-idempotent sources where duplicate delivery is impossible
- Internal event buses — use a proper message queue instead

## Common Violations
- Parsing body with `c.req.json()` before signature verification: the signature is computed over the raw text; JSON re-serialisation would invalidate it
- Throwing inside a handler on missing fields: Stripe retries on non-200 responses, causing infinite retry loops; log and return instead
- Omitting `paymentEvents` INSERT: without idempotency, concurrent deliveries can create duplicate subscription records
- Using `switch` instead of the dispatch map: `Record<string, handler | undefined>` makes adding new event types trivial without restructuring the handler
