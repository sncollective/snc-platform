# Platform CLAUDE.md

## Claude Skills

Project-specific skills live at `.claude/skills/`:
- `platform-patterns` — code pattern index and detailed pattern files
- `platform-design-principles` — architectural principles (Ports & Adapters, SSOT, Generated Contracts)
- `platform-implementation-principles` — code-level principles (Fail Fast, guard clauses, validation)

Scan rule libraries (auto-discovered by refactor workflows):
- `scan-stylistic` · `scan-structural` · `scan-quality` · `scan-performance` · `scan-accessibility` · `scan-documentation`
- `security-scan` — security-focused scan rules

---

# Coding Conventions

## Naming
- camelCase for functions, variables, and object properties
- PascalCase for types, interfaces, classes, and React components
- SCREAMING_SNAKE_CASE for module-level constants
- kebab-case for file names (e.g., `booking-request.ts`, not `bookingRequest.ts`)
- Suffix Hono route handler files with `.routes.ts`; Drizzle schema files with `.schema.ts`

## Error Handling
- Use typed `AppError` subclasses (e.g., `NotFoundError`, `UnauthorizedError`) extending
  a base `AppError` class; never throw plain `Error` for expected failures
- API routes return structured JSON errors: `{ error: { code, message, details? } }`
- Hono middleware catches `AppError` instances and maps them to HTTP status codes
- Never let Stripe or Shopify errors propagate unhandled — wrap in `AppError` with context
- Use `Result<T, E>` types for service-layer functions that can fail predictably

## Imports
- Named exports only — no default exports anywhere in the codebase
- Use `node:` protocol for built-in modules (`node:fs`, `node:path`, `node:crypto`)
- Group imports: node builtins → external packages → internal workspace packages →
  relative imports; blank line between groups
- Import Zod as `import { z } from "zod"` in `packages/shared`; use `zod/mini` in
  `apps/web` for bundle size
- Reference shared types via the workspace alias `@snc/shared`, never via relative
  `../../packages/shared` paths

## Testing
- Use Vitest `describe` / `it` pattern; test files mirror `src/` structure under `tests/`
- Unit tests mock external services (Stripe, Shopify, storage provider) via `vi.mock()`
- Integration tests in `tests/integration/` use a real PostgreSQL container
- Every Hono route must have at least one happy-path test and one auth/validation failure test
- StorageProvider implementations must be tested via the shared provider contract test suite

## File Organization
- One module per file, named after its primary export
- `index.ts` files only for re-exports — no implementation in index files
- Hono app: routes grouped by domain under `src/routes/` (e.g., `src/routes/content.routes.ts`)
- Drizzle schemas co-located with their domain (e.g., `src/db/schema/content.schema.ts`)
- Storage providers in `apps/api/src/storage/` implementing `StorageProvider` interface
  from `packages/shared`

## Code Style
- TypeScript strict mode: `strict: true`, `noUncheckedIndexedAccess: true`,
  `exactOptionalPropertyTypes: true`
- Prefer `const` assertions and discriminated unions over enums
- `async/await` throughout — never `.then()` / `.catch()` chains
- Destructure function parameters when there are more than 2 arguments
- All Hono route handlers must be typed with `zValidator` input validation —
  never access `c.req.json()` without schema validation

## Documentation
- JSDoc (`/** */`) required on exported functions in shared packages, services, and middleware
- Focus on intent and contracts, not type restatement — see `.claude/rules/inline-documentation.md`
- `@throws` required when a function throws (vs returning `Result`)
- Skip docs on schema declarations, re-exports, test files, and self-documenting constants

## CSS
- Use design tokens from `apps/web/src/styles/global.css` via `var(--token-name)` — never hardcode hex values or pixel sizes
- Import only your own component's `.module.css` — never import another component's CSS module

## Docker Networking
- You are running inside a Docker container on the shared `claude-net` Docker network
- Postgres starts automatically on container boot via `scripts/platform/start-dev.sh` (in the parent monorepo)
- To restart Postgres manually:
  `docker compose -f docker-compose.yml -f docker-compose.claude.yml up -d`
- Use the container name to reach services — Docker DNS resolves them automatically:
  - `DATABASE_URL=postgres://snc:snc@snc-postgres:5432/snc`
- Fallback if shared network doesn't work: use `host.docker.internal` with the
  host-mapped port (e.g., `postgres://snc:snc@host.docker.internal:5432/snc`)

## Repository Context

### Key Directories
- `apps/api/src/` — Hono API server with OpenAPI 3.1
  - `app.ts` — Hono instance: middleware stack + route registration for all domain groups
  - `index.ts` — Server entry point with `@hono/node-server`, graceful shutdown
  - `config.ts` — Zod-validated env config (`ENV_SCHEMA`, 60+ fields covering database, auth, S3, Stripe, Shopify, SMTP, Owncast, federation, feature flags); exports `parseConfig`, `getFeatureFlags`, `parseOrigins`
  - `auth/` — Better Auth instance (Drizzle adapter, email/password, OIDC provider), role service, OIDC client seeding
  - `db/schema/` — Drizzle schema files: `user`, `content`, `creator`, `subscription`, `booking`, `calendar`, `emission`, `oidc`, `project`
  - `email/` — SMTP transporter singleton + inquiry email templates
  - `lib/` — Shared helpers: cursor pagination, file utils, OpenAPI error schemas, route utils, calendar/content/response helpers
  - `logging/` — Pino logger factory with header redaction + dev pretty-print
  - `middleware/` — Auth (required, optional, role-based), CORS, error handler, rate limiter, request logger (hono-pino)
  - `routes/` — Domain-grouped handlers: `admin`, `auth`, `booking`, `calendar` (events, event-types, feed), `content` (CRUD, media), `creator` (profiles, events, members), `dashboard`, `emissions`, `federation`, `me`, `merch`, `project`, `streaming`, `studio`, `subscription`, `upload`, `webhook`
  - `scripts/` — `seed-admin` (assign admin role), `seed-demo` (full demo dataset)
  - `services/` — Business logic: content-access (subscription gating), creator-list/team, emissions, external-error, owncast, revenue, shopify, slug, stripe/stripe-client
  - `storage/` — `StorageProvider` interface with local filesystem and S3-compatible implementations (+ S3 multipart upload)
- `apps/api/tests/` — Vitest tests mirroring `src/` structure; fixture factories in `tests/helpers/`
- `apps/web/src/` — TanStack Start frontend: React 19, SSR, file-based routing
  - `routes/` — File-based routes: landing, auth (login, register, forgot-password), feed, content detail (by ID and by slug), creators (listing, profile, manage with nested tabs for content/calendar/members/projects/settings), admin, calendar, dashboard, emissions, merch, pricing, projects, services, settings (password, subscriptions, bookings), studio, checkout (success/cancel)
  - `components/` — React components grouped by domain: `admin`, `auth`, `booking`, `calendar`, `coming-soon`, `content`, `creator`, `dashboard`, `emissions`, `error`, `federation`, `landing`, `layout`, `media`, `merch`, `project`, `social-links`, `studio`, `subscription`, `ui`, `upload`
  - `contexts/` — Audio player (reducer + provider + Web Audio API) and upload (Uppy + S3 multipart)
  - `hooks/` — Shared hooks: cursor-pagination, calendar-state, checkout, content management (form fields, submit, editing), dismiss, file-input, guest-redirect, media-controls, menu-toggle, platform-auth, route-announcer, subscriptions
  - `lib/` — API clients per domain (admin, booking, calendar, content, creator, dashboard, emissions, merch, project, subscription, uploads), auth (client + SSR helpers), fetch-utils, form-utils, format, config, errors, logging, co2-equivalencies, offset-impact, chart-math
  - `config/` — Navigation links constant
  - `styles/` — CSS custom properties (design tokens) in `global.css` + shared CSS modules (button, detail-section, error-alert, form, landing-section, list-items, listing-page, page-heading, settings-page, success-alert)
- `apps/web/tests/` — Vitest tests mirroring `src/` structure; fixture factories + shared mocks in `tests/helpers/`
- `packages/shared/src/` — Zod schemas, TypeScript types, and utilities shared by API and web: `admin`, `auth`, `booking`, `calendar`, `content`, `creator`, `dashboard`, `emissions`, `errors`, `features`, `federation`, `merch`, `pagination`, `project`, `result`, `storage`, `storage-contract`, `streaming`, `studio`, `subscription`, `uploads`
- `docker-compose.yml` — PostgreSQL 16 (`snc-postgres` container)
- `apps/api/drizzle.config.ts` — Drizzle Kit migration config
- `apps/api/drizzle/migrations/` — SQL migrations

### Build & Test
- `pnpm --filter @snc/api test` — run API unit tests
- `pnpm --filter @snc/shared test` — run shared package tests
- `pnpm --filter @snc/web test` — run web unit tests
- `pnpm --filter @snc/api dev` — start API dev server (Node 24+ with `--experimental-strip-types`)
- `pnpm --filter @snc/web dev` — start web dev server (TanStack Start on port 3001)
- `docker compose -f docker-compose.yml -f docker-compose.claude.yml up -d` — start PostgreSQL (with claude-net)

### Golden Path E2E (`apps/e2e/`)

Playwright end-to-end tests covering the production-enabled feature surface. Scoped to the three live feature flags: **creator**, **admin**, **calendar**.

- `pnpm --filter @snc/e2e test` — run the full suite (24 tests, ~6s)
- `pnpm --filter @snc/e2e test:headed` — run with visible browser
- `pnpm --filter @snc/e2e test:debug` — step-through debugger
- `pnpm --filter @snc/e2e report` — view last HTML report

**How it works:**
- Runs against the **staging environment** locally (`localhost:3082` via Caddy) which mirrors production feature flags
- Uses demo seed data (seeded by `seed:demo`) — no separate test database needed
- Global setup logs in as three demo users (admin, stakeholder, subscriber) and caches auth cookies as Playwright storage states
- Tests use `getByRole`/`getByText`/`getByLabel` selectors — resilient to CSS and component refactors
- CI job in `.forgejo/workflows/test-and-build.yml` runs with a disposable Postgres, migrations, and demo seed

**Test coverage:**
| Area | Tests | Auth |
|------|-------|------|
| Landing page | hero, featured creators, nav | anonymous |
| Creator browsing | listing, view toggle, profile, bio, social links | anonymous |
| Auth flow | register, logout, login | anonymous → authenticated |
| Feature gates | disabled routes redirect | anonymous |
| Auth guards | protected routes → login with returnTo | anonymous |
| Admin panel | user list, role badges | admin |
| Calendar | grid, filters, view toggle | stakeholder |
| Creator management | tabbed dashboard, settings | stakeholder |
| Settings | change password form | subscriber |
| Navigation | page links, user menu, route access | stakeholder |
| Accessibility | skip link, keyboard nav, aria attributes | anonymous |

**When to update:** Add tests when a new feature flag is enabled in production. The suite intentionally stays small and stable — it tests what real users can reach, not internal implementation.

## Agent Commands

Structured commands for pipeline skills to discover automatically. These run from the project root.

- build-shared: `pnpm --filter @snc/shared build`
- test-shared: `pnpm --filter @snc/shared test`
- build-api: `pnpm --filter @snc/api build`
- test-api: `pnpm --filter @snc/api test`
- build-web: `pnpm --filter @snc/web build`
- test-web: `pnpm --filter @snc/web test`
- test-all: `pnpm --filter @snc/shared test && pnpm --filter @snc/api test && pnpm --filter @snc/web test`
- db-generate: `pnpm --filter @snc/api db:generate`
- db-migrate: `pnpm --filter @snc/api db:migrate`
- test-e2e: `pnpm --filter @snc/e2e test`
- dev-restart: `pm2 restart all`
- dev-status: `pm2 status`

