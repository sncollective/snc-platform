---
updated: 2026-04-16
---

# Platform AGENTS.md

Hono API + TanStack Start + Drizzle ORM + PostgreSQL + Garage S3. Monorepo with Bun workspaces: `@snc/api`, `@snc/web`, `@snc/shared`, `@snc/e2e`.

## Build & Test

- `bun run --filter @snc/api test:unit` / `bun run --filter @snc/web test` / `bun run --filter @snc/shared test` — unit tests
- `bun run --filter @snc/api test:integration` — integration tests (real dev env, pre-review gate)
- `bun run --filter @snc/e2e test` — Playwright golden-path e2e (staging env, localhost:3082)
- `bun run --filter @snc/api dev` / `bun run --filter @snc/web dev` — dev servers
- `docker compose -f docker-compose.yml -f docker-compose.claude.yml up -d` — start PostgreSQL

## Tech References

Library-specific quick references live under `.claude/skills/<lib>/SKILL.md` — read the body of the relevant one when working with that library. Each carries imports, API quick reference, gotchas, and anti-patterns. Available libraries: `hono-v4`, `drizzle-v0`, `tanstack-router-v1`, `tanstack-table-v8`, `zod-v4`, `ark-ui-v5`, `garage-v2`, `pg-boss-v12`, `imgproxy-v3`, `vidstack-v1`, `uppy-tus-v5`, `tusd-v2`, `liquidsoap-v2`, `srs-v6`, `pino-logging`. The YAML frontmatter is a Claude Code loading hint; non-Claude agents should read the markdown body directly. Treat as the in-repo source of truth for that library before reaching for upstream docs or `reference/`.

Scan rule libraries (`scan-structural`, `scan-quality`, `scan-accessibility`, `scan-performance`, `scan-seo`, `scan-documentation`, `scan-stylistic`) live alongside the tech references and follow the same convention.

## Substrate, work, and research bands

Platform's persistent state splits across three top-level bands by output-class: `.memory/` (internal substrate), `.work/` (work items — output-class), and `.research/` (research output, operationalizing ARD v0.1). The conventions for each are in `.claude/rules/` (auto-loaded on the relevant paths) and summarized here.

### `.memory/` — substrate (internal working state)

- **`decisions/`** — structured position records with rationale, alternatives, and `revisit_if` conditions. Filename: `platform-NNNN-<slug>.md`.
- **`sessions/`** — short episodic summaries of significant recent work.
- **`scratchpad/`** (gitignored) — ephemeral in-flight artifacts. Promote anything worth keeping; the rest auto-deletes.
- **`agents/`** (gitignored) — per-agent private state.

Design/scoping briefs are **not** a separate tier — item matter lives inline in the work-item file (the feature/story file *is* the design surface), per `.claude/rules/item-convention.md §Where matter lives`.

### `.work/` — work items (output-class)

Items are the unit of persistent work, carrying structured state in frontmatter (`kind` / `stage` / `tags` / `release_binding`). Tiers:

- **`active/`** — scoped, in-flight, grouped by kind: `epics/`, `features/`, `stories/`.
- **`backlog/`** — unscoped, parked ideas (flat files).
- **`releases/`** — shipped version bundles (`<version>.md` + archived per-release item trees). Platform ships versioned releases, so items bind to a release at review-pass.
- **`archive/`** — done items without a release binding (kind-grouped).

Convention: `.claude/rules/item-convention.md` (structure), `item-pipelines.md` (stage flow + quality gates), `tag-taxonomy.md` (tag rubric).

### `.research/` — research band (ARD v0.1)

Platform **adopts ARD v0.1** (Agentic Research Discipline — MIT-licensed, agent-agnostic; codified per `.memory/decisions/platform-0013-adopt-work-research-bands.md`). The band carries external substrate + agent engagement with sources, read down-gradient only:

- **`reference/`** — source-direct raw fetches (gitignored) + per-corpus INDEX/README.
- **`attestation/`** — flat per-source-handle files (`<handle>.md`) — the citation anchor for `[handle]{N}` references.
- **`precis/`** — engagement-unit aggregations authored from raw.
- **`analysis/`** — cross-source work: `briefs/`, `campaigns/`, `positions/`, `hypothesis/`, and `<topic>.md` catalogs.

The discipline (anti-fabrication core, per-source attestation, verification stack) is vendored in `.claude/rules/research-band-spec.md` (architecture) + `research-band-catalogs.md` (baseline inventory) + `research-band-platform.md` (platform's deployment mapping). MIT attribution for the research band is carried in those rule files.

When in doubt about which tier, scratchpad is safe — anything worth keeping gets promoted explicitly.

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

Dockerized services (Postgres, Garage S3, SRS, Liquidsoap, imgproxy, Mailpit) run on the `platform_default` docker network and publish their ports to the host. Code that runs **outside** the docker network — pm2-managed API/web on the dev host, drizzle-kit, ad-hoc `bun` shells — reaches them via `localhost:<published-port>`. That's what `.env.example` defaults to.

Code that runs **inside** the docker network (container-to-container calls) uses the docker service names (`snc-postgres:5432`, `snc-garage:3900`, `snc-srs:1935`, `snc-liquidsoap:1936`).

## Email in dev (Mailpit)

`docker-compose.yml` runs Mailpit as `snc-mailpit`: SMTP listener on `localhost:1025`, web inbox at `http://localhost:8025`. Default `.env.example` SMTP values point at it. Outgoing mail is captured but never delivered — safe to test password resets, invites, notifications etc. without touching a real relay. Override `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` for staging/prod relays.

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
