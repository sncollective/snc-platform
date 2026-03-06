# Pattern: Hono Typed Env

A dedicated `*Env` type with a `Variables` map provides compile-time type safety for `c.get()` / `c.set()` across middleware chains.

## Rationale

Hono's context is untyped by default — `c.get("user")` returns `unknown`. By defining an `Env` type with a `Variables` record and passing it as the generic `Hono<Env>` (or `MiddlewareHandler<Env>`), TypeScript enforces that only known keys are read/written and infers their types automatically. This eliminates casts in handlers and catches key typos at compile time.

## Examples

### Example 1: AuthEnv definition
**File**: `apps/api/src/middleware/auth-env.ts:10`
```typescript
import type { User, Session, Role } from "@snc/shared";

export type AuthEnv = {
  Variables: {
    user: User;
    session: Session;
    roles: Role[];
  };
};
```

### Example 2: Middleware using AuthEnv to set typed context variables
**File**: `apps/api/src/middleware/require-auth.ts:1`
```typescript
import type { MiddlewareHandler } from "hono";
import type { AuthEnv } from "./auth-env.js";

export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) throw new UnauthorizedError();
  c.set("user", { ...session.user, image: session.user.image ?? null });
  c.set("session", session.session);
  const roles = await getUserRoles(session.user.id);
  c.set("roles", roles);                // always populated alongside user
  await next();
};
```

**File**: `apps/api/src/middleware/require-role.ts:21`
```typescript
export const requireRole = (
  ...roles: Role[]
): MiddlewareHandler<AuthEnv> => {
  return async (c, next) => {
    const user = c.get("user");          // typed as User
    const userRoleValues = c.get("roles"); // typed as Role[], set by requireAuth
    if (!roles.some((r) => userRoleValues.includes(r))) {
      throw new ForbiddenError("Insufficient permissions");
    }
    await next();
  };
};
```

### Example 3: Test app typed with AuthEnv for typed context assertions
**File**: `apps/api/tests/middleware/require-auth.test.ts:16`
```typescript
const setupAuthApp = async (): Promise<Hono<AuthEnv>> => {
  // ...mocks...
  const app = new Hono<AuthEnv>();
  app.get("/protected", requireAuth, (c) => {
    return c.json({
      user: c.get("user"),       // typed as User — no cast needed
      session: c.get("session"), // typed as Session
    });
  });
  return app;
};
```

## When to Use
- Any group of middleware that writes named values to Hono context for downstream handlers to read
- When a route group requires typed access to request-scoped data (user, session, tenant, etc.)
- In test apps to verify that middleware correctly sets context variables

## When NOT to Use
- One-off route handlers that don't share context with adjacent middleware
- When context variables are only used within a single middleware (no downstream reads)

## Common Violations
- Defining `Variables` inline on each `Hono<{ Variables: ... }>` instead of exporting a shared `Env` type — makes the type hard to reuse in middleware and tests
- Using `c.get("user") as User` cast instead of parameterizing with the `Env` type — bypasses compile-time checking
- Forgetting to type `MiddlewareHandler<AuthEnv>` on middleware — `c.set()` then accepts any key/value and loses type safety
