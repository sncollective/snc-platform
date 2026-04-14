# Platform AGENTS.md

Hono API + TanStack Start + Drizzle ORM + PostgreSQL + Garage S3. Monorepo with Bun workspaces: `@snc/api`, `@snc/web`, `@snc/shared`, `@snc/e2e`.

## Build & Test

- `bun run --filter @snc/api test:unit` / `bun run --filter @snc/web test` / `bun run --filter @snc/shared test` — unit tests
- `bun run --filter @snc/api test:integration` — integration tests (real dev env, pre-review gate)
- `bun run --filter @snc/e2e test` — Playwright golden-path e2e (staging env, localhost:3082)
- `bun run --filter @snc/api dev` / `bun run --filter @snc/web dev` — dev servers
- `docker compose -f docker-compose.yml -f docker-compose.claude.yml up -d` — start PostgreSQL

## Coding Conventions

**Naming:** camelCase vars/functions, PascalCase types/components, SCREAMING_SNAKE constants, kebab-case files. Suffix: `.routes.ts` (Hono), `.schema.ts` (Drizzle).

**Error handling:** Typed `AppError` subclasses, never plain `Error`. `Result<T, E>` for service-layer. Structured JSON errors: `{ error: { code, message, details? } }`.

**Imports:** Named exports only. `node:` protocol for builtins. Group: builtins → external → `@snc/shared` → relative, blank lines between. `zod/mini` in web, `zod` in shared.

**Testing:** Vitest `describe`/`it`. Test files mirror `src/` under `tests/`. Mock externals via `vi.mock()`. Every route needs happy-path + auth-failure tests.

**File organization:** One module per file. `index.ts` for re-exports only. Routes under `src/routes/`, schemas under `src/db/schema/`.

**Code style:** TypeScript strict mode (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). `const` assertions over enums. `async/await` only, no `.then()` chains. `validator` (from `hono-openapi`) on all route inputs with `describeRoute` for OpenAPI docs.

**Docs:** See `.claude/rules/inline-documentation.md`.

**CSS:** Design tokens via `var(--token-name)` from `global.css`. Only import your own `.module.css`.

## Docker Networking

Running inside a Docker container on `claude-net`. Services: `snc-postgres:5432`, `snc-garage:3900` (S3). Fallback: `host.docker.internal`.

## Agent Commands

Structured commands for pipeline skills. Run from the project root.

- build-shared: `bun run --filter @snc/shared build`
- test-shared: `bun run --filter @snc/shared test`
- build-api: `bun run --filter @snc/api build`
- test-api: `bun run --filter @snc/api test:unit`
- test-api-integration: `bun run --filter @snc/api test:integration`
- build-web: `bun run --filter @snc/web build`
- test-web: `bun run --filter @snc/web test`
- test-all: `bun run --filter @snc/shared test && bun run --filter @snc/api test:unit && bun run --filter @snc/web test`
- db-generate: `bun run --filter @snc/api db:generate`
- db-migrate: `bun run --filter @snc/api db:migrate`
- test-e2e: `bun run --filter @snc/e2e test`
- dev-restart: `pm2 restart all`
- dev-status: `pm2 status`

## Database Migrations

Never hand-write migration SQL — generate via `drizzle-kit`. See `.claude/rules/drizzle-migrations.md` for the workflow.

## UX Decisions

When a UX tradeoff surfaces, follow the "agent surfaces evidence, user decides" framework in `docs/ux-decisions.md` rather than silently picking one path.

## Release Versioning

Pre-1.0 — all current releases. 1.0 reserved for cooperative launch.

- **Major milestones** (`0.{minor}`) — big feature bundles. Increment minor for each major milestone (e.g., 0.1 Foundation, 0.2 Streaming Goes Live).
- **Point releases** (`0.{minor}.{patch}`) — incremental work within a major. Increment patch for each point release (e.g., 0.2.1, 0.2.2).
- **Board naming:** `boards/platform/release-{version}/` — each release gets its own board directory.
- **Theme titles:** each release has a short theme used in the board heading (e.g., "Admin Polish + Playout Redesign").

**Releases are scoping units, not deployment units.** Multiple releases can be active at different stages simultaneously. All development happens on main. Deployment ships everything that's been reviewed — which may span multiple releases. Quality gates run once against the combined deployment surface.
