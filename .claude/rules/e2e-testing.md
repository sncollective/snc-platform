---
paths:
  - "apps/e2e/**"
---

# Golden Path E2E Testing

Playwright tests in `apps/e2e/` covering all routes not behind an active feature flag.

## How it works

- Runs against staging (`localhost:3082` via Caddy) which disables the active feature flags listed in `packages/shared/src/features.ts`
- Uses demo seed data (`seed:demo`) — no separate test database
- Global setup logs in as 3 demo users (admin, stakeholder, subscriber), caches auth cookies as Playwright storage states
- Selectors: `getByRole`/`getByText`/`getByLabel` — resilient to CSS refactors

## Commands

- `bun run --filter @snc/e2e test` — full suite
- `bun run --filter @snc/e2e test:headed` — visible browser
- `bun run --filter @snc/e2e test:debug` — step-through
- `bun run --filter @snc/e2e report` — view HTML report

## When to update

Add tests when a feature flag is removed (feature ships). Remove tests when a feature flag is added (feature is gated during development). The suite stays small and stable — it tests what real users can reach, not internal implementation.
