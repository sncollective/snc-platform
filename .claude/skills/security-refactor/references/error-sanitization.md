# Rule: Error Sanitization

> Client-facing error responses use typed AppError codes only. Server-side logs redact PII/secrets before writing.

**Domain**: code

## Motivation

OWASP A04 (Insecure Design) + A09 (Logging Failures). Error responses that leak database column names, file paths, or stack traces help attackers map internal architecture. Server-side logs that contain unredacted PII or secrets create compliance risk and expand the blast radius of a log access breach.

## Before / After

### From this codebase: error handler logging full error object

**Before:**
```typescript
// error-handler.ts — current pattern
console.error("Unhandled error:", e);
// Logs the full Error object including stack trace, DB details, etc.
```

**After:**
```typescript
console.error("Unhandled error:", {
  message: e instanceof Error ? e.message : "Unknown error",
  path: c.req.path,
  method: c.req.method,
  // Stack trace only in development
  ...(process.env.NODE_ENV === "development" && {
    stack: e instanceof Error ? e.stack : undefined,
  }),
});
```

### Synthetic example: service error leaking internals

**Before:**
```typescript
try {
  await stripe.subscriptions.create(params);
} catch (e) {
  // Passes Stripe error directly to client — may contain customer IDs, plan metadata
  throw new AppError("STRIPE_ERROR", e.message, 500);
}
```

**After:**
```typescript
try {
  await stripe.subscriptions.create(params);
} catch (e) {
  console.error("Stripe subscription creation failed:", {
    type: e.type,
    code: e.code,
  });
  throw new AppError("PAYMENT_ERROR", "Payment processing failed", 500);
}
```

## Exceptions

- Development-only verbose logging (gated behind `NODE_ENV === "development"`)
- Seed scripts and CLI tools that log to stdout for operator feedback

## Scope

- Applies to: `apps/api/src/middleware/error-handler.ts`, all service files wrapping external APIs
- Does NOT apply to: seed scripts, migration scripts, build tooling
