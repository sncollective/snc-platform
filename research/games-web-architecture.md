# Games Web Architecture

**Status:** Research complete — implementation deferred until platform refactor finishes
**Date:** 2026-03-08

How to structure web-based collaboration tools for S/NC Games (asset management, design docs, task boards, playtesting feedback) so they reuse platform code without living inside the platform repo.

**Priorities:** code reuse, contributor independence, cooperative alignment

---

## The Problem

S/NC Games needs internal web tools for game designers. These tools are CRUD-heavy and overlap heavily with existing platform patterns — Hono API middleware, Better Auth, shared types (errors, Result, roles), React hooks, CSS design tokens. Building from scratch would duplicate most of this work. But the tools should eventually be a separate project so game contributors don't need the full platform codebase.

The platform (`snc-platform`) is a Bun monorepo with `apps/api`, `apps/web`, and `packages/shared`. It's a git submodule in the parent SNC repo. Games web tools need to consume shared code from it without creating git conflicts or tight coupling.

**Key fact:** Git submodules are just commit pointers at different paths. Sibling submodules (`platform/` and a future `games-web/`) never conflict with each other. The real question is code sharing friction, not git conflicts.

---

## Options

### 1. Monorepo expansion — add games apps to snc-platform

Add `apps/games-api/` and `apps/games-web/` to the existing platform Bun workspace.

| Factor | Assessment |
|--------|-----------|
| Code sharing | Best — `workspace:*` links, instant updates, zero publishing |
| Independent deployment | Good — each app has its own build scripts; CI can filter by path |
| Contributor independence | Poor — game devs must clone entire platform repo, navigate platform CI/PRs |
| Setup complexity | Low — just add workspace entries |
| Fits SNC structure | Poor — breaks "one submodule per project"; the platform repo becomes a god repo |

Simplest technically, but conflates two sub-orgs (platform vs. games) into one codebase. Works while the team is two people. Breaks when S/NC Games has its own contributors.

### 2. Shared packages via Forgejo npm registry (recommended)

Extract cross-project code into standalone packages. Publish to Forgejo's built-in npm registry. Games-web repo consumes them as normal npm dependencies.

| Factor | Assessment |
|--------|-----------|
| Code sharing | Good — versioned packages, explicit dependencies |
| Independent deployment | Excellent — fully independent CI/CD |
| Contributor independence | Excellent — game devs never touch platform repo |
| Setup complexity | Medium — need to extract packages, set up CI publishing, configure registry |
| Fits SNC structure | Best — separate submodule per project, shared code via registry |

The right long-term architecture. Forgejo at `code.s-nc.org` already supports this — no new infrastructure. The extraction work validates API boundaries before committing to publishing.

### 3. Fork and diverge

Copy platform patterns into a new repo. Evolve independently.

| Factor | Assessment |
|--------|-----------|
| Code sharing | None after fork — duplicated code drifts |
| Independent deployment | Excellent |
| Contributor independence | Excellent |
| Setup complexity | Low initially |
| Fits SNC structure | Acceptable |

Only viable if the shared surface area is tiny and stable. It isn't — auth, errors, and Result types are foundational and actively evolving. Bug fixes applied twice. Rejected.

### 4. Submodule nesting — platform as submodule inside games-web

`snc-games-web` includes `snc-platform` as a git submodule, references its packages via path aliases.

| Factor | Assessment |
|--------|-----------|
| Code sharing | Fragile — Bun workspaces can't span into submodules cleanly |
| Independent deployment | Good |
| Contributor independence | Poor — game devs must init platform submodule |
| Setup complexity | Very high — tooling fights at every step |
| Fits SNC structure | Poor — double-nested submodules in parent repo |

Bun workspaces, TypeScript project references, and git submodules were not designed for this nesting. Rejected.

---

## How FOSS Orgs Handle This

### GNOME — layered shared libraries

Separate repos per library (GLib, GTK, libadwaita). Each has its own release cycle. Apps depend on published, versioned releases — a GNOME app developer never clones GTK's repo to build their app. The libraries form a stack: foundation (GLib/GObject) → toolkit (GTK) → design layer (libadwaita) → apps.

**Relevant pattern:** Extract shared code as standalone libraries with stable APIs. Publish to a registry. Consumers pin versions.

### Apache NiFi — multi-repo with shared libs

Split from a monorepo into `nifi-framework`, `nifi-registry`, `nifi-extensions`, plus `nifi-standard-libs` for shared auth/security code. Shared libs published as Maven artifacts. Rationale: faster builds, better separation of concerns, independent release cycles. Trade-off: cross-cutting changes require snapshot builds and coordinated releases.

**Relevant pattern:** Shared libraries as the bridge between independent repos. Same approach we're taking, npm instead of Maven.

### Matrix/Element — SDK per language

Language-specific SDKs in separate repos (matrix-js-sdk, matrix-rust-sdk, etc.). Client apps depend on published SDK packages. The SDK defines the contract; apps build on top.

**Relevant pattern:** The shared package *is* the interface boundary. Don't share raw code — share a designed API.

---

## Recommendation

**Staged package extraction.** Start inside the platform monorepo (zero new tooling), then publish to Forgejo npm when games-web becomes its own repo.

### Phase 1: Extract `@snc/core` inside platform monorepo

Create `platform/packages/core/` with the genuinely cross-project code that currently lives in `@snc/shared`:

| Module | Contents |
|--------|----------|
| `errors.ts` | AppError hierarchy (NotFound, Unauthorized, Forbidden, Validation, RateLimit) |
| `result.ts` | `Result<T, E>` discriminated union, `ok()`, `err()` |
| `auth.ts` | ROLES, UserSchema, SessionSchema, AuthSessionSchema |
| `storage.ts` | StorageProvider interface, ACCEPTED_MIME_TYPES, MAX_FILE_SIZES |
| `storage-contract.ts` | Contract test suite for StorageProvider implementations |

`@snc/shared` re-exports everything from `@snc/core` so existing imports don't break. Platform-specific schemas (content, creator, subscription, merch, booking, etc.) stay in `@snc/shared`. The root `package.json#workspaces` array already globs `packages/*`, so `packages/core/` is auto-discovered.

### Phase 2: Extract reusable middleware and hooks

**`@snc/hono-middleware`** (`platform/packages/hono-middleware/`):
- error-handler, require-auth, require-role, auth-env, rate-limit, cors
- Cursor pagination (encode/decode/buildPaginatedResponse)
- wrapExternalError factory

**`@snc/react-lib`** (`platform/packages/react-lib/`):
- fetch-utils (apiGet, apiMutate, apiUpload, throwIfNotOk)
- use-cursor-pagination, use-menu-toggle, use-guest-redirect
- Auth hooks (useSession, useRoles, hasRole)
- Format utils, CSS design tokens

Update `apps/api` and `apps/web` to import from the new packages.

### Phase 3: Create `snc-games-web` as a separate repo

- New repo on Forgejo: `snc-games-web`
- Bun monorepo with `apps/` and `packages/games-shared/`
- Depends on `@snc/core`, `@snc/hono-middleware`, `@snc/react-lib` via Forgejo npm registry
- Added as submodule in parent SNC repo (location TBD)
- Mirrored to GitHub like all other repos
- CI in platform auto-publishes shared packages on tagged releases

### Phase 4: Full independence when team grows

Shared packages could move to their own repo if the platform monorepo feels wrong as a home. Or stay where they are — the npm registry decouples the repos regardless of where the source lives.

---

## Architecture Decisions

**Auth:** Single Better Auth instance, shared user/session tables. Games-web API connects to the same PostgreSQL auth tables. One identity across all of S/NC.

**Database:** Games-web uses a separate PostgreSQL schema (or separate database) for game-specific data. No foreign keys to platform content tables.

**Design system:** Shared CSS custom properties (design tokens) exported via `@snc/react-lib`. Same S/NC visual identity — game tools aren't a different brand.

**Roles:** Game-specific roles (e.g., `game-designer`, `game-tester`) added to the ROLES array in `@snc/core`. Single change flows to all consumers.

---

## Forgejo npm Registry

Already available at `code.s-nc.org`. No new infrastructure needed.

**Configuration:**
```bash
npm config set @snc:registry https://code.s-nc.org/api/packages/sncollective/npm/
npm config set -- '//code.s-nc.org/api/packages/sncollective/npm/:_authToken' "{token}"
```

**Publishing:**
```bash
npm publish --scope=@snc --registry=https://code.s-nc.org/api/packages/sncollective/npm/
```

Supports scoped and unscoped packages. Auth via personal access token.

---

## Target Structure

```
SNC/                              # parent monorepo
  platform/                       # submodule -> snc-platform
    apps/api/                     # @snc/api
    apps/web/                     # @snc/web
    packages/core/                # @snc/core (cross-project types)
    packages/shared/              # @snc/shared (platform schemas + re-exports core)
    packages/hono-middleware/     # @snc/hono-middleware
    packages/react-lib/           # @snc/react-lib
  games/
    arcade/first-contact-agency/  # submodule -> Godot game
    TBD/                          # submodule -> snc-games-web
      apps/designer-tools/        # @snc-games/designer-tools
      packages/games-shared/      # @snc-games/shared
```

---

## References

- [GNOME Libraries Overview](https://developer.gnome.org/documentation/introduction/overview/libraries.html)
- [Apache NiFi Repository Restructuring](https://cwiki.apache.org/confluence/display/NIFI/NiFi+Project+and+Repository+Restructuring)
- [Forgejo npm Package Registry](https://forgejo.org/docs/latest/user/packages/npm/)
- [Verdaccio](https://www.verdaccio.org/) — alternative private npm registry (not needed, Forgejo has this built in)
- [monorepo.tools](https://monorepo.tools/) — monorepo patterns comparison

*Last updated: 2026-03-08*
