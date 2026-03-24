# Pattern: Thin Handlers, Fat Services

Route handlers parse input, validate, delegate to a service function, and respond (~30 lines). Business logic, DB queries, and domain rules live in `services/`.

## Rationale

Hono route handlers that inline business logic become untestable monoliths coupled to HTTP context. Services are pure TypeScript — no Hono imports, no `c.get()` or `c.json()`, testable without HTTP context. This matches existing services like `content-access.ts`, `stripe.ts`, `shopify.ts`, and `revenue.ts`, which return either `Result<T, AppError>` or typed discriminated unions.

## Examples

### Example 1: Service function with typed return (discriminated union)
**File**: `apps/api/src/services/content-access.ts:164`
```typescript
// Service: pure TypeScript, no Hono imports, testable in isolation
export const checkContentAccess = async (
  userId: string | null,
  contentCreatorId: string,
  contentVisibility: Visibility,
  prefetchedRoles?: string[],
): Promise<ContentGateResult> => {
  if (contentVisibility === "public") return { allowed: true };
  if (userId === null) {
    return {
      allowed: false,
      reason: "AUTHENTICATION_REQUIRED",
      creatorId: contentCreatorId,
    };
  }

  const ctx = await buildContentAccessContext(userId, prefetchedRoles);
  if (hasContentAccess(ctx, contentCreatorId, contentVisibility)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "SUBSCRIPTION_REQUIRED",
    creatorId: contentCreatorId,
  };
};
```

### Example 2: Thin handler delegating to service
**File**: `apps/api/src/routes/content.routes.ts:302`
```typescript
// Route handler: parse → delegate → respond
const gate = await checkContentAccess(
  userId,
  row.creatorId,
  row.visibility,
);
if (!gate.allowed) {
  if (gate.reason === "AUTHENTICATION_REQUIRED") {
    throw new UnauthorizedError("Authentication required");
  }
  throw new ForbiddenError("Subscription required");
}
```

### Example 3: Service returning Result<T, AppError>
**File**: `apps/api/src/services/revenue.ts`
```typescript
// Service: wraps external calls, returns Result
export const getMonthlyRevenue = async (
  months: number,
): Promise<Result<MonthlyRevenue[], AppError>> => {
  try {
    const invoices = await stripe.invoices.list({ ... });
    // ... grouping, zero-filling
    return ok(result);
  } catch (e) {
    return err(wrapStripeError(e));
  }
};
```

### Example 4: Handler consuming Result
**File**: `apps/api/src/routes/dashboard.routes.ts`
```typescript
// Thin handler: validate → delegate → unwrap Result → respond
const result = await getMonthlyRevenue(months);
if (!result.ok) {
  throw result.error;  // AppError caught by errorHandler middleware
}
return c.json({ data: result.value });
```

## When to Use

- Handler contains DB queries beyond a single trivial lookup
- Handler has business logic (permission checks, state transitions, calculations)
- Same logic is needed by multiple routes or could be needed later
- Logic needs unit testing without HTTP context

## When NOT to Use

- **Trivial handlers** (<10 lines) like `GET /health` returning `c.json({ ok: true })`
- **Middleware-heavy routes** where complexity is in middleware composition, not handler logic
- **Within-file DRY** — if helpers are only used by handlers in the same file, use unexported private helpers instead (see [route-private-helpers.md](route-private-helpers.md))

## Common Violations

- Inlining DB queries and business logic in a route handler that exceeds ~30 lines
- Importing `hono` types in a service module — services receive and return plain TypeScript types
- Returning raw `throw new Error(...)` from a service instead of `Result<T, AppError>` or a typed discriminated union
- Mixing HTTP concerns (`c.json()`, `c.req.param()`) into service functions

## Related Patterns

- [route-private-helpers.md](route-private-helpers.md) — within-file DRY (complementary: private helpers stay in the route file; services extract to `services/`)
- [stripe-service-layer.md](stripe-service-layer.md) — specific application of this pattern for Stripe
- [result-type.md](result-type.md) — the `Result<T, AppError>` return convention used by services
- [app-error-hierarchy.md](app-error-hierarchy.md) — typed errors that services return
