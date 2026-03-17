# Extract `@snc/core` from `@snc/shared`

## Context

Every web project S/NC builds will share foundational code: error types, Result pattern, auth types (ROLES, UserSchema, SessionSchema), and the StorageProvider interface. Known future consumers beyond the current platform:

- **S-NC.tv** — streaming platform (Owncast + Restreamer, shares auth DB)
- **S/NC Games Web** — designer tools, asset management, playtesting
- **Governance tools** — member voting, proposals, financial reporting, onboarding
- **Collaboration tools** — calendar, working group coordination
- **Future sub-org platforms** — Publishing, Podcast, Video, Writing

All share a single Better Auth instance and PostgreSQL auth tables. The cross-project types currently mixed into `@snc/shared` need their own package so consumers don't pull in platform-specific domain schemas (content, merch, booking, etc.).

This is Phase 1 of the staged extraction plan from `docs/research/games-web-architecture.md`. Phases 2-3 (`@snc/hono-middleware`, `@snc/react-lib`) deferred until a second consumer is closer to implementation.

## Repo & Folder Decision

**Shared packages stay in the platform monorepo** (`platform/packages/`). Reasons:

- pnpm workspaces can't span git submodule boundaries — putting packages at the SNC root or in a standalone repo means no `workspace:*` linking during development
- Zero new tooling — `pnpm-workspace.yaml` already globs `packages/*`
- Cross-cutting changes land in one PR, one test run
- The Forgejo npm registry decouples consumers regardless of where the source lives
- Matches GNOME precedent: the team that builds the foundation maintains it; consumers depend on releases
- Can always move packages to their own repo later with zero API changes

## Approach

Create `platform/packages/core/` as a new pnpm workspace package. Move the 5 cross-project modules from `@snc/shared`. Have `@snc/shared` depend on `@snc/core` and re-export everything — zero breaking changes to existing imports.

## Target Structure

```
platform/packages/core/
  package.json          # @snc/core, deps: zod, devDeps: vitest, typescript
  tsconfig.json
  src/
    index.ts            # barrel: re-exports errors, result, auth, storage
    errors.ts           # AppError, NotFoundError, UnauthorizedError, ForbiddenError, ValidationError, RateLimitError
    result.ts           # Result<T, E>, ok(), err()
    auth.ts             # ROLES, RoleSchema, UserSchema, SessionSchema, AuthSessionSchema
    storage.ts          # StorageProvider interface, ACCEPTED_MIME_TYPES, MAX_FILE_SIZES
    storage-contract.ts # runStorageContractTests(), textToStream, streamToText
  tests/
    errors.test.ts      # moved from packages/shared/tests/
    result.test.ts
    auth.test.ts
    storage.test.ts
    storage-contract.test.ts
```

## Implementation Steps

### 1. Create `packages/core/` package scaffold
- `package.json` — name `@snc/core`, version `0.1.0`, same shape as `@snc/shared` (type: module, exports `.` and `./testing`)
- `tsconfig.json` — mirrors `@snc/shared` config
- `src/index.ts` — barrel re-exports

### 2. Move source files
Move from `packages/shared/src/` to `packages/core/src/`:
- `errors.ts`
- `result.ts`
- `auth.ts`
- `storage.ts` (imports `result.ts` and `errors.ts` — internal refs stay relative)
- `storage-contract.ts` (imports `storage.ts` and `errors.ts`)

### 3. Move test files
Move corresponding tests from `packages/shared/tests/` to `packages/core/tests/`.

### 4. Update `@snc/shared`
- Add `@snc/core` as `workspace:*` dependency in `package.json`
- Replace the 5 direct exports in `src/index.ts` with re-exports from `@snc/core`:
  ```typescript
  export * from "@snc/core";
  // ... platform-specific schemas below
  export * from "./content.js";
  // etc.
  ```
- Update `exports["./testing"]` to re-export from `@snc/core/testing`
- Remove the moved source files from `packages/shared/src/`

### 5. Verify
- `pnpm -C platform --filter @snc/core test` — new package tests pass
- `pnpm -C platform --filter @snc/shared test` — existing tests still pass via re-exports
- `pnpm -C platform --filter @snc/api test` — API tests pass (344 tests)
- `pnpm -C platform --filter @snc/web test` — web tests pass (567 tests)
- `pm2 restart all` — dev servers boot and work

## Key Files

| File | Action |
|------|--------|
| `platform/packages/shared/src/index.ts` | Replace direct exports with re-exports from `@snc/core` |
| `platform/packages/shared/package.json` | Add `@snc/core` workspace dependency |
| `platform/packages/shared/src/errors.ts` | Delete (moved to core) |
| `platform/packages/shared/src/result.ts` | Delete (moved to core) |
| `platform/packages/shared/src/auth.ts` | Delete (moved to core) |
| `platform/packages/shared/src/storage.ts` | Delete (moved to core) |
| `platform/packages/shared/src/storage-contract.ts` | Delete (moved to core) |
| `platform/pnpm-workspace.yaml` | No change needed (already globs `packages/*`) |

## Future Phases (Not in Scope)

### Phase 2: `@snc/hono-middleware`
- Deps: `@snc/core`, `hono`
- Extracts: error-handler, auth-env, require-role, rate-limit, cursor pagination, external-error factory, cors factory
- **Requires refactoring:** `require-auth.ts` must convert to `createRequireAuth({ getSession, getUserRoles })` factory (currently imports platform's Better Auth instance directly)

### Phase 3: `@snc/react-lib`
- Deps: `@snc/core`, `react`
- Extracts: fetch-utils, form-utils, format utils, use-cursor-pagination, use-menu-toggle, CSS design tokens
- **Requires refactoring:** Auth hooks must convert to `createAuthHooks(authClient)` factory (currently coupled to platform's Better Auth client)

### Phase 4: Forgejo npm publishing
- CI workflow publishes `@snc/core`, `@snc/hono-middleware`, `@snc/react-lib` on tagged releases
- Tag format: `core@0.1.0`, `hono-middleware@0.1.0`, `react-lib@0.1.0`
- External consumers install via `.npmrc` scoped registry config

*Created: 2026-03-11*
