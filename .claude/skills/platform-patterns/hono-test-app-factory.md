# Pattern: Hono Test App Factory

A local `createTestApp()` / `setupCorsApp()` factory creates a fresh minimal `Hono` instance per test — wiring only the middleware under test — so tests are isolated from the full app.

## Rationale

Importing the full `app` from `app.ts` in middleware tests couples tests to all registered routes and middleware, making failures hard to localize. Constructing a minimal Hono instance per test ensures that only the system under test is exercised. `app.request()` provides a zero-dep HTTP call without spinning up a real server.

## Examples

### Example 1: Error handler factory (static, synchronous)
**File**: `apps/api/tests/middleware/error-handler.test.ts:23`
```typescript
const createTestApp = (errorToThrow: Error) => {
  const app = new Hono();
  app.onError(errorHandler);
  app.get("/test", () => {
    throw errorToThrow;
  });
  return app;
};

// Usage:
const app = createTestApp(new NotFoundError("thing not found"));
const res = await app.request("/test");
expect(res.status).toBe(404);
```

### Example 2: CORS middleware factory (async, dynamic import)
**File**: `apps/api/tests/middleware/cors.test.ts:14`
```typescript
const setupCorsApp = async (corsOrigin: string): Promise<Hono> => {
  vi.doMock("../../src/config.js", () => ({
    config: { ...TEST_CONFIG, CORS_ORIGIN: corsOrigin },
  }));
  const { corsMiddleware } = await import("../../src/middleware/cors.js");
  const app = new Hono();
  app.use("*", corsMiddleware);
  app.get("/test", (c) => c.json({ ok: true }));
  return app;
};

// Usage in describe block:
beforeEach(async () => {
  app = await setupCorsApp("http://localhost:3080");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});
```

### Example 3: Module-level app import for route tests (no factory needed)
**File**: `apps/api/tests/routes/health.test.ts:3`
```typescript
import { app } from "../../src/app.js";

describe("GET /health", () => {
  it("returns 200 with { status: 'ok' }", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toStrictEqual({ status: "ok" });
  });
});
```

## When to Use

- Unit testing individual middleware functions (`errorHandler`, `corsMiddleware`) — always use a factory
- When the middleware under test reads module-level config at import time — use `vi.doMock` + async factory
- Route tests that just verify behaviour of the full app can import `app` directly

## When NOT to Use

- Integration tests against a running HTTP server — use a real server with supertest or `fetch`
- When testing multiple middleware interactions together — import the full `app` instead

## Common Violations

- Calling `app.use("*", errorHandler)` instead of `app.onError(errorHandler)` — Hono v4 requires `onError` for catching route handler throws
- Forgetting `vi.resetModules()` in `afterEach` when using dynamic imports — stale module cache bleeds config between test groups
- Not calling `vi.doMock` before the dynamic `import()` — `doMock` must precede the import that captures the mocked value
