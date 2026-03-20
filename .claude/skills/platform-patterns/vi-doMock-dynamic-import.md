# Pattern: vi.doMock + Dynamic Import

Module-level dependencies mocked before dynamic import; `vi.resetModules()` in `afterEach` ensures per-test isolation.

## Rationale

Modules that read config or initialize singletons at load time (e.g., `corsMiddleware`, `betterAuth`, Drizzle `db`) cannot be mocked with `vi.mock()` because static mocks hoist after the module is already evaluated. `vi.doMock()` + dynamic `import()` defers the import until after the mock is registered, and `vi.resetModules()` purges the module cache so the next test gets a fresh import.

## Examples

### Example 1: Mocking auth instance and config for route tests
**File**: `apps/api/tests/routes/auth.routes.test.ts:17`
```typescript
const setupAuthRoutesApp = async (): Promise<Hono> => {
  vi.doMock("../../src/config.js", () => ({
    config: TEST_CONFIG,
    parseOrigins: (raw: string) =>
      raw.split(",").map((o: string) => o.trim()).filter(Boolean),
  }));

  vi.doMock("../../src/auth/auth.js", () => ({
    auth: { handler: mockHandler },
  }));

  const { authRoutes } = await import("../../src/routes/auth.routes.js");
  const { errorHandler } = await import("../../src/middleware/error-handler.js");
  const { corsMiddleware } = await import("../../src/middleware/cors.js");

  const app = new Hono();
  app.use("*", corsMiddleware);
  app.onError(errorHandler);
  app.route("/api/auth", authRoutes);
  return app;
};

afterEach(() => {
  vi.resetModules(); // purge module cache for next test
});
```

### Example 2: Mocking Better Auth session API for middleware tests
**File**: `apps/api/tests/middleware/require-auth.test.ts:14`
```typescript
const mockGetSession = vi.fn();

const setupAuthApp = async (): Promise<Hono<AuthEnv>> => {
  vi.doMock("../../src/auth/auth.js", () => ({
    auth: { api: { getSession: mockGetSession } },
  }));

  const { requireAuth } = await import("../../src/middleware/require-auth.js");
  const { errorHandler } = await import("../../src/middleware/error-handler.js");

  const app = new Hono<AuthEnv>();
  app.onError(errorHandler);
  app.get("/protected", requireAuth, (c) =>
    c.json({ user: c.get("user"), session: c.get("session") })
  );
  return app;
};

afterEach(() => {
  vi.resetModules();
});
```

### Example 3: Mocking config with per-test override for CORS tests
**File**: `apps/api/tests/middleware/cors.test.ts:14`
```typescript
const setupCorsApp = async (corsOrigin: string): Promise<Hono> => {
  vi.doMock("../../src/config.js", () => ({
    config: { ...TEST_CONFIG, CORS_ORIGIN: corsOrigin },
    parseOrigins: (raw: string) =>
      raw.split(",").map((o: string) => o.trim()).filter(Boolean),
  }));
  const { corsMiddleware } = await import("../../src/middleware/cors.js");
  const app = new Hono();
  app.use("*", corsMiddleware);
  app.get("/test", (c) => c.json({ ok: true }));
  return app;
};
```

### Example 4: Mocking a class-constructor SDK (Stripe)
**File**: `apps/api/tests/services/stripe.test.ts:34`
```typescript
// Arrow functions and vi.fn() cannot be called with `new`.
// A regular function that returns an object satisfies `new Stripe(...)`:
// the non-null return value overrides `this`, giving callers the mock instance.
vi.doMock("stripe", () => ({
  default: function MockStripe() {
    return mockStripeInstance;
  },
}));

vi.doMock("../../src/config.js", () => ({ config: TEST_CONFIG }));

const { getOrCreateCustomer } = await import("../../src/services/stripe.js");
```

## Note on Mock Cleanup

`restoreMocks: true` in vitest.config.ts handles mock cleanup globally — only `vi.resetModules()` is needed in `afterEach`.

## When to Use
- Testing modules that read config or initialize singletons at module load time
- When the same module needs different mock values across test cases
- Testing middleware that depends on an external service (Better Auth, Stripe, etc.)
- Mocking third-party class-constructor SDKs (e.g., `new Stripe(...)`) — use a regular function returning the mock instance

## When NOT to Use
- Pure utility functions with no side-effectful imports — use regular `vi.mock()` hoisting
- When mocking only a small pure function — prefer direct injection or parameter passing

## Common Violations
- Using `vi.mock()` instead of `vi.doMock()`: static mocks hoist before imports, so they run before `doMock()` calls and won't intercept eagerly-initialized singletons
- Forgetting `vi.resetModules()` in `afterEach`: module cache persists across tests, causing mock bleed-through
- Resetting mocks with `mockReset()` but not clearing modules: the mock function is reset but the module is still cached with the old factory
