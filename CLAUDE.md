# Platform CLAUDE.md

Hono API + TanStack Start + Drizzle ORM + PostgreSQL + Garage S3. Monorepo with pnpm workspaces: `@snc/api`, `@snc/web`, `@snc/shared`, `@snc/e2e`.

## Build & Test

- `pnpm --filter @snc/api test` / `pnpm --filter @snc/web test` / `pnpm --filter @snc/shared test`
- `pnpm --filter @snc/e2e test` — Playwright golden-path e2e (staging env, localhost:3082)
- `pnpm --filter @snc/api dev` / `pnpm --filter @snc/web dev` — dev servers
- `docker compose -f docker-compose.yml -f docker-compose.claude.yml up -d` — start PostgreSQL

## Coding Conventions

**Naming:** camelCase vars/functions, PascalCase types/components, SCREAMING_SNAKE constants, kebab-case files. Suffix: `.routes.ts` (Hono), `.schema.ts` (Drizzle).

**Error handling:** Typed `AppError` subclasses, never plain `Error`. `Result<T, E>` for service-layer. Structured JSON errors: `{ error: { code, message, details? } }`.

**Imports:** Named exports only. `node:` protocol for builtins. Group: builtins → external → `@snc/shared` → relative, blank lines between. `zod/mini` in web, `zod` in shared.

**Testing:** Vitest `describe`/`it`. Test files mirror `src/` under `tests/`. Mock externals via `vi.mock()`. Every route needs happy-path + auth-failure tests.

**File organization:** One module per file. `index.ts` for re-exports only. Routes under `src/routes/`, schemas under `src/db/schema/`.

**Code style:** TypeScript strict mode (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). `const` assertions over enums. `async/await` only, no `.then()` chains. `validator` (from `hono-openapi`) on all route inputs with `describeRoute` for OpenAPI docs.

**Docs:** JSDoc on exports from shared packages, services, middleware. Focus on intent, not type restatement. `@throws` when function throws. See `.claude/rules/inline-documentation.md`.

**CSS:** Design tokens via `var(--token-name)` from `global.css`. Only import your own `.module.css`.

## Docker Networking

Running inside a Docker container on `claude-net`. Services: `snc-postgres:5432`, `snc-garage:3900` (S3). Fallback: `host.docker.internal`.

## Agent Commands

Structured commands for pipeline skills. Run from the project root.

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
