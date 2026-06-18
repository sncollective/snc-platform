---
updated: 2026-06-17
---

# Platform AGENTS.md

Hono API + TanStack Start + Drizzle ORM + PostgreSQL + Garage S3. Monorepo with Bun workspaces: `@snc/api`, `@snc/web`, `@snc/shared`, `@snc/e2e`.

## Codex working notes

Codex loads this `AGENTS.md` as the primary project instruction file. `CLAUDE.md` remains a
useful index, but its slash-command and auto-load language is Claude-specific:

- Read `.agents/rules/*.md` before designing, implementing, or reviewing work items.
- For path-specific behavior, read the relevant `.claude/rules/*.md` manually. In particular:
  `document-evolution.md` for persistent artifacts, `path-conventions.md` for links/paths,
  `platform-patterns.md` for platform code shape, `testing-strategy.md` for test work,
  `drizzle-migrations.md` for schema changes, and `e2e-testing.md` for Playwright work.
- Treat `.claude/skills/<name>/SKILL.md` as local reference docs. For platform code, read the
  relevant tech reference or scan library before reaching for upstream docs.
- Claude plugin commands such as `/agile-workflow:review` are not Codex commands. Use
  `.work/bin/work-view` to inspect queue state and update item files directly when a workflow
  step has no Codex-native command.
- Keep secrets opaque. Do not open `.env*`; let dev scripts and test runners load them as
  subprocess inputs.

## Build & Test

- `bun run --filter @snc/api test:unit` / `bun run --filter @snc/web test` / `bun run --filter @snc/shared test` — unit tests
- `bun run --filter @snc/api test:integration` — integration tests (real dev env, pre-review gate)
- `bun run --filter @snc/e2e test` — Playwright golden-path e2e (staging env, localhost:3082). First run on a fresh container: `bash scripts/dev/install-e2e-browsers.sh` (browsers install on demand, not in the devcontainer lifecycle)
- `bun run --filter @snc/api dev` / `bun run --filter @snc/web dev` — dev servers
- `docker compose -f docker-compose.yml -f docker-compose.claude.yml up -d` — start PostgreSQL
- `bash scripts/dev/start-dev.sh` — full service bootstrap (Caddy, docker stack with `--wait`, Garage init, PM2 dev servers); idempotent, the devcontainer runs it on every start. Environment definition lives in `.devcontainer/devcontainer.json`; `.env` scaffolding via `scripts/dev/ensure-env.sh`. The `docker-compose.claude.yml` overlay is applied automatically when the external `claude-net` network exists, skipped otherwise.

### Running tests from the agent sandbox

A human developer ignores this section — their shell runs in the base namespace where the dev services and `.env` are directly reachable, so plain `bun run --filter @snc/api test:unit` / `test:integration` just works. The Claude Code **agent** sandbox differs on two axes, and integration tests need both bridged (unit tests need neither — fake env, all externals mocked — so the agent runs them directly):

- **Network.** Each agent Bash command runs in its own network namespace whose only listeners are the egress proxies (SOCKS5 `127.0.0.1:1080`, HTTP `:3128`). The dockerized services publish on the base-namespace localhost — a different netns — so `127.0.0.1:5432` is unreachable directly. `scripts/dev/sandbox-forward.py` relays the backing services onto the sandbox's localhost through the SOCKS proxy. Pure userspace TCP: no docker-socket access, no privilege, the socket stays at its default `660`.
- **Secrets.** The agent's file reads deny `.env*`. The integration suite loads `platform/.env` (`DATABASE_URL` + `BETTER_AUTH_SECRET`) via dotenv, so the sandbox must re-allow *subprocess* reads of that file.

`scripts/dev/sandbox-test-integration.sh` wires both — forwarder up → `bun run --filter @snc/api test:integration` → teardown.

For Codex, start with the normal project commands. Unit tests should run directly. Integration
and e2e tests need the dev services plus subprocess access to local `.env`; if the active
Codex sandbox blocks localhost, Docker, or environment-file access, request the narrow
permission change needed for the command instead of copying secrets or reading `.env` into the
thread. The Claude-specific forwarder above is only needed when running under Claude Code's
separate network namespace.

The secrets carve-out lives in `.claude/settings.local.json` (machine-local, gitignored):

```json
"sandbox": {
  "filesystem": { "allowRead": ["/home/agent/SNC/platform/.env"] },
  "network": { "allowLocalBinding": true }
}
```

Load-bearing: the read-allow key is the **flat `allowRead`** — a nested `read: { allowWithinDeny: [...] }` is silently ignored (that wrong shape cost a session to diagnose). `allowRead` re-allows subprocess reads only; the agent's own Read tool stays blocked and `.env.production*` / `.env.local` stay denied — so this exposes only the local-dev DB URL + auth secret. `allowLocalBinding: true` is required for the forwarder to bind localhost ports. Rejected alternative: a separate gitignored secret-bridge file the agent reads — the carve-out is cleaner (real `.env` stays the single source, no second copy of the creds to drift).

## Tech References

Library-specific quick references live under `.claude/skills/<lib>/SKILL.md` — read the body of the relevant one when working with that library. Each carries imports, API quick reference, gotchas, and anti-patterns. Available libraries: `hono-v4`, `drizzle-v0`, `tanstack-router-v1`, `tanstack-table-v8`, `zod-v4`, `ark-ui-v5`, `garage-v2`, `pg-boss-v12`, `imgproxy-v3`, `vidstack-v1`, `uppy-tus-v5`, `tusd-v2`, `liquidsoap-v2`, `srs-v6`, `pino-logging`. The YAML frontmatter is a Claude Code loading hint; non-Claude agents should read the markdown body directly. Treat as the in-repo source of truth for that library before reaching for upstream docs or `reference/`.

Scan rule libraries (`scan-structural`, `scan-quality`, `scan-accessibility`, `scan-performance`, `scan-seo`, `scan-documentation`, `scan-stylistic`) live alongside the tech references and follow the same convention.

## Substrate, work, and research bands

Platform's persistent state splits across three top-level bands by output-class: `.memory/` (internal substrate), `.work/` (work items — output-class), and `.research/` (research output, operationalizing ARD v0.5.1 via the agentic-research plugin). The conventions for each are in `.claude/rules/` (auto-loaded on the relevant paths) and summarized here.

### `.memory/` — substrate (internal working state)

- **`sessions/`** — short episodic summaries of significant recent work.
- **`scratchpad/`** (gitignored) — ephemeral in-flight artifacts. Promote anything worth keeping; the rest auto-deletes.
- **`agents/`** (gitignored) — per-agent private state.

Research-grounded stances live in `.research/analysis/positions/`; rules state their own constraints and load-bearing rejected alternatives inline. There is no separate decisions tier — positions live in the artifacts they govern.

Design/scoping briefs are **not** a separate tier — item matter lives inline in the work-item file (the feature/story file *is* the design surface).

### `.work/` — work items (output-class)

Items are the unit of persistent work, carrying structured state in frontmatter (`kind` / `stage` / `tags` / `release_binding`). Tiers:

- **`active/`** — scoped, in-flight, grouped by kind: `epics/`, `features/`, `stories/`.
- **`backlog/`** — unscoped, parked ideas (flat files).
- **`releases/`** — shipped version bundles (`<version>.md` + archived per-release item trees). Platform ships versioned releases, so items bind to a release at review-pass.
- **`archive/`** — done items without a release binding (kind-grouped).

Convention: `.work/CONVENTIONS.md` (tag rubric, gate config, slug conventions, platform-local conventions) + `.agents/rules/agile-workflow.md` (plugin-managed rules block).

### `.research/` — research band (ARD v0.5.1, plugin mode)

Platform adopts **ARD v0.5.1** (Agentic Research Discipline — MIT-licensed, agent-agnostic) transitively through the **agentic-research plugin's** drift-fenced vendored kernel. The band carries external substrate + agent engagement with sources, read down-gradient only:

- **`reference/`** — source-direct raw fetches (gitignored) + per-corpus INDEX/README.
- **`attestation/`** — flat per-source-handle files (`<handle>.md`) — the citation anchor for `[handle]{N}` references.
- **`precis/`** — engagement-unit aggregations authored from raw.
- **`analysis/`** — cross-source work: `briefs/`, `campaigns/`, `positions/`, `hypothesis/`, and `<topic>.md` catalogs.
- **`bin/research-view`** — installed query tool (from the plugin's `install-research-view.sh`).

The working contract (path map, frontmatter shapes, citation rule, lint invocation, engagement entry, MIT attribution) is in `.research/CONVENTIONS.md`. Platform carries no in-tree ARD kernel copy — the plugin provides the lint, catalogs, and discipline bundle as external tools.

When in doubt about which tier, scratchpad is safe — anything worth keeping gets promoted explicitly.

## Key Technology Selections

Research-grounded; full rationale + rejected alternatives in `.research/analysis/positions/`.

- **Streaming server: SRS** (not MediaMTX or Owncast) — native multi-channel and reliable native simulcast forwarding are the load-bearing requirements. See `srs-streaming-server.md` + `tv-model-playout-architecture.md`.
- **Object storage: Garage** (alongside Seafile for studio sync) — nonprofit governance, single-binary simplicity, sufficient S3 compatibility. See `garage-object-storage.md`.
- **Job queue: pg-boss** (not BullMQ / Temporal) — zero new infrastructure; uses existing PostgreSQL. See `pg-boss-job-queue.md`.
- **Media player: Vidstack** with Video.js v10 as migration watch target (GA expected mid-2026). See `vidstack-media-player.md`.
- **Playout engine: Liquidsoap** — 20+ years production-tested, `fallback()` live switching validated at Phase 5 spike. See `liquidsoap-playout-engine.md`.
- **API source of truth: hand-written three-layer pattern** (status quo, neutral) — deferred until second consumer or bug-rate condition trips. See `api-source-of-truth.md`.
- **Route handler ceremony: explicit 6-step pattern** (status quo, neutral) — deferred until human collaborators join. See `route-handler-ceremony.md`.

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
- **Theme titles:** each release has a short theme title (e.g., "Admin Polish + Playout Redesign").

**Releases are scoping units, not deployment units.** Multiple releases can be active at different stages simultaneously. All development happens on main. Deployment ships everything that's been reviewed — which may span multiple releases. Quality gates run once against the combined deployment surface.

## Agile-Workflow Substrate

<!-- agile-workflow:start -->
Work tracked in `.work/` as markdown items with YAML frontmatter
(`id, kind, stage, tags, release_binding, depends_on, gate_origin, created, updated, parent`).
A `[research]` item additionally carries its engagement registration in a `research_dials:`
nested frontmatter block (`scope_authority, verification_rigor, intent, output_kind`) read
by the orchestrator at dispatch. Layout: `.work/active/{epics,features,stories}/`,
`.work/backlog/`, `.work/releases/<version>/`, `.work/archive/`.

**Primary query tool:** `.work/bin/work-view` filters by stage, tag, kind, parent, and
dependency. Common patterns:
- `work-view --ready` — items ready to work (deps satisfied)
- `work-view --stage review` — items awaiting review
- `work-view --parent <id>` / `--blocking <id>` — hierarchy / sequencing
- `work-view --scope all` — include terminal tiers: `releases/` (summary docs + archived item
  trees) and `archive/` (bodyless ref stubs). Default shows only active + backlog.
- `work-view --help` for the full flag set

Foundation docs in `docs/` describe the system's current state or intended future state,
never the past; git history is the audit trail. Item files are the durable state — update the
body with implementation discoveries, review findings, blockers, and decisions instead of
relying on chat history.

Agent rules live in `.agents/rules/agile-workflow.md` (plugin-managed; carry the
`<!-- agile-workflow:rules:start/end -->` markers). Read them before designing, implementing,
or reviewing. The three bespoke item rules (`item-convention`, `item-pipelines`, `tag-taxonomy`)
are retired; the plugin's rules block and `.work/CONVENTIONS.md` are canonical.

Full tag rubric, gate config, slug conventions, and platform-local conventions live in
`.work/CONVENTIONS.md`.
<!-- agile-workflow:end -->

### Platform specifics

- **Terminal-tier retention: `delete-refs`** — archive items become bodyless ref stubs going
  forward; full bodies live in git history. Historical exception: the pre-conversion release
  archive under `releases/0.3.0/` retains full bodies as a migrated exception (no retroactive
  prune); `delete-refs` applies from conversion forward.
- **Release mapping: `none`** — platform ships versioned releases as scoping units, but
  deployment is user-at-station (manual ship from the operator's station). The plugin does not
  tag or branch on release. After `stage: released` is set, the operator walks the `## Prod
  verification` section of the release file for prod-only checks (OAuth/SMTP/SRS RTMP/real
  follower paths) that require production credentials and can't run in CI.
- **Fix-verify loopback** — each user-verifiable fix is re-confirmed by the user in the
  running app before the story closes, stronger than the plugin's default bounce-and-re-review.
  Applies wherever a non-agent can visually or behaviorally confirm the change.
- **`scan-*` gate seam** — the eight `scan-*` rule libraries under `.claude/skills/scan-*`
  plug into the plugin's `gate-refactor` seam automatically via the `refactor` entry in
  `gates_for_release` declared in `.work/CONVENTIONS.md`. No additional configuration needed.
