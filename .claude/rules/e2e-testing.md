---
paths:
  - "apps/e2e/**"
---

# Golden Path E2E Testing

Playwright tests in `apps/e2e/` covering the production-enabled feature surface.

## How it works

- Runs against staging (`localhost:3082` via Caddy) which mirrors production feature flags
- Uses demo seed data (`seed:demo`) — no separate test database
- Global setup logs in as 3 demo users (admin, stakeholder, subscriber), caches auth cookies as Playwright storage states
- Selectors: `getByRole`/`getByText`/`getByLabel` — resilient to CSS refactors

## Commands

- `pnpm --filter @snc/e2e test` — full suite
- `pnpm --filter @snc/e2e test:headed` — visible browser
- `pnpm --filter @snc/e2e test:debug` — step-through
- `pnpm --filter @snc/e2e report` — view HTML report

## When to update

Add tests when a new feature flag is enabled in production. The suite stays small and stable — it tests what real users can reach, not internal implementation.
