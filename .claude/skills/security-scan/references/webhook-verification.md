# Rule: Webhook Verification

> All inbound webhooks verify signatures before processing. Unknown event types are logged, not silently dropped.

**Domain**: code

## Motivation

OWASP A08 (Software and Data Integrity Failures). Unverified webhooks allow attackers to forge events — triggering fake subscription activations, payment confirmations, or data mutations. Silently dropping unknown event types hides potential issues or new event types that need handling.

## Before / After

### From this codebase: Stripe webhook (correct pattern)

**Before:** *(what a violation would look like)*
```typescript
webhookRoutes.post("/stripe", async (c) => {
  const event = await c.req.json(); // No signature verification!
  await handleStripeEvent(event);
  return c.json({ received: true });
});
```

**After:** *(the established pattern)*
```typescript
webhookRoutes.post("/stripe", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("stripe-signature") ?? "";
  const verifyResult = verifyWebhookSignature(rawBody, signature);
  if (!verifyResult.ok) throw verifyResult.error;
  const event = verifyResult.value;
  await handleStripeEvent(event);
  return c.json({ received: true });
});
```

### Synthetic example: unknown event type handling

**Before:**
```typescript
switch (event.type) {
  case "checkout.session.completed":
    await handleCheckout(event);
    break;
  default:
    // Silently ignored — no visibility into unhandled events
    break;
}
```

**After:**
```typescript
switch (event.type) {
  case "checkout.session.completed":
    await handleCheckout(event);
    break;
  default:
    console.warn(JSON.stringify({
      event: "unhandled_webhook",
      type: event.type,
      provider: "stripe",
      timestamp: new Date().toISOString(),
    }));
    break;
}
```

## Exceptions

- None — all inbound webhooks must verify signatures. No exceptions.

## Scope

- Applies to: all webhook route handlers in `apps/api/src/routes/webhook.routes.ts`
- Does NOT apply to: outbound webhook calls made by the platform
