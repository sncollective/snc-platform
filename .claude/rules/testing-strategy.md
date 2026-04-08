---
paths:
  - "apps/api/tests/integration/**"
  - "apps/api/vitest*.config.ts"
---

# Testing Strategy

Three tiers, ordered by speed. Always use explicit script names — there is no bare `test` script on the API package.

| Tier | Script | Environment | Speed | When to run |
|------|--------|-------------|-------|-------------|
| Unit | `pnpm --filter @snc/api test:unit` | Fake env vars, all externals mocked | ~5s | During development, agent workflows, CI |
| Integration | `pnpm --filter @snc/api test:integration` | Real `.env`, real Postgres + Garage | ~15-30s | Pre-review quality gate |
| E2E | `pnpm --filter @snc/e2e test` | Full staging (localhost:3082) | ~60s+ | Pre-deploy quality gate |

## Unit tests

- Config: `vitest.config.ts`
- Pattern: `setupRouteTest` factory mocks DB, storage, config, auth
- Location: `tests/routes/`, `tests/services/`, `tests/middleware/`, etc.
- See `platform-patterns.md` for `setupRouteTest`, `vi-doMock-dynamic-import`, and other unit test patterns

## Integration tests

- Config: `vitest.integration.config.ts`
- Location: `tests/integration/`
- Loads real `.env` via dotenv — no fake env vars, no mocks
- Sequential execution (`fileParallelism: false`), 30s timeout
- Process isolation (`pool: "forks"`) — each test file gets a clean app import
- Tests the full assembled app against real services (Postgres, Garage)
- Requires dev services running (PM2 or docker compose)

## E2E tests

- Config: `apps/e2e/playwright.config.ts`
- See `.claude/rules/e2e-testing.md` for details

## Adding new integration tests

Integration tests import the real app with no mocking:

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.resetModules();
});

describe("my integration test", () => {
  it("works against real services", async () => {
    const { app } = await import("../../src/app.js");
    const res = await app.request("/my-endpoint");
    expect(res.status).toBe(200);
  });
});
```

Use `vi.resetModules()` in `afterEach` so each test gets a fresh app instance. No `vi.doMock` — the real storage, config, and DB connection flow through.
