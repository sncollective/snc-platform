# Style: Early Returns

> Use guard clauses and early returns instead of nested if/else.

## Motivation

Guard clauses handle edge cases and error conditions at the top of a function, then let the
main logic flow without indentation. This reduces cognitive load — you handle the "what could
go wrong" first, then read the happy path linearly. In a Hono/Express-style API, early returns
also prevent accidentally falling through to response logic after an error.

## Before / After

### From this codebase: auth middleware guard

**Before:** (actual code from `apps/api/src/middleware/require-auth.ts`)
```typescript
export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    const logger = c.var?.logger ?? rootLogger;
    logger.warn(
      { event: "auth_failure", path: c.req.path, method: c.req.method },
      "Authentication failed — no valid session",
    );
    throw new UnauthorizedError();
  }

  c.set("user", { ...session.user /* ... */ });
  c.set("session", { ...session.session /* ... */ });
  await next();
};
```
This already follows the pattern — the guard clause (`if (!session)`) exits early, and the
main logic runs unindented.

### Synthetic example: nested conditional anti-pattern

**Before:**
```typescript
async function processOrder(order: Order, user: User): Promise<Result<Receipt, AppError>> {
  if (order.items.length > 0) {
    if (user.verified) {
      if (order.total <= user.balance) {
        const receipt = await chargeUser(user, order.total);
        return ok(receipt);
      } else {
        return err(new ValidationError("Insufficient balance"));
      }
    } else {
      return err(new ForbiddenError("User not verified"));
    }
  } else {
    return err(new ValidationError("Order has no items"));
  }
}
```

**After:**
```typescript
async function processOrder(order: Order, user: User): Promise<Result<Receipt, AppError>> {
  if (order.items.length === 0) {
    return err(new ValidationError("Order has no items"));
  }
  if (!user.verified) {
    return err(new ForbiddenError("User not verified"));
  }
  if (order.total > user.balance) {
    return err(new ValidationError("Insufficient balance"));
  }

  const receipt = await chargeUser(user, order.total);
  return ok(receipt);
}
```

## Exceptions

- **Switch statements** — exhaustive switches on discriminated unions are not nesting; they're dispatch. Don't rewrite them as early returns.
- **Short ternaries** — `const x = condition ? a : b` is fine. This rule targets multi-line if/else blocks, not inline value selection.
- **Try/catch at boundaries** — a single try/catch wrapping a route handler or middleware is acceptable. The rule targets nested conditionals, not error boundaries.

## Scope

- Applies to: all TypeScript files in `apps/api/src/`, `apps/web/src/`, `packages/shared/src/`
- Does NOT apply to: test files (test setup often uses nested describes/beforeEach legitimately), generated code
