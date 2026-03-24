# Feature Flag System

Feature flags gate entire platform domains -- content, merch, booking, etc. -- so that unreleased features can be disabled in production while remaining fully available in development. Flags are defined once in `@snc/shared`, read from environment variables on both the API and web sides, and enforced at the route level on both server and client.

## How It Works

The system has three layers:

**Shared definitions** (`packages/shared/src/features.ts`) — The `FEATURE_FLAGS` array is the single source of truth for all flag names. It also exports the `FeatureFlags` type (a readonly record mapping every flag to a boolean), two presets (`ALL_FEATURES_ON`, `PRODUCTION_DEFAULTS`), and `FEATURE_LABELS` (human-readable name and description for each flag).

**API server** (`apps/api/src/config.ts`) — Environment variables named `FEATURE_<FLAG>` (e.g., `FEATURE_MERCH`) are parsed by Zod as boolean strings. The `getFeatureFlags(cfg)` function extracts a `FeatureFlags` object from the parsed config. The module-level `features` singleton is used in `apps/api/src/app.ts` to conditionally mount route groups:

```ts
if (features.merch) app.route("/api/merch", merchRoutes);
if (features.booking) app.route("/api", bookingRoutes);
```

When a flag is OFF, its API routes are never registered -- requests return 404.

**Web client** (`apps/web/src/lib/config.ts`) — Each flag is read from `import.meta.env.VITE_FEATURE_<FLAG>` via a helper that defaults absent values to `true` (all features ON in dev). The exported `isFeatureEnabled(flag)` function is called in route files to gate pages at load time.

## Flag Definitions

| Flag | Label | Description | Production Default |
|------|-------|-------------|-------------------|
| `content` | Content | Videos, audio, and written content from our creators. | ON |
| `creator` | Creators | Creator profiles, portfolios, and subscription pages. | ON |
| `subscription` | Subscriptions | Platform and creator subscription plans. | OFF |
| `merch` | Merch | Merchandise from our creators and the collective. | OFF |
| `booking` | Studio | Recording studio, podcast production, practice space, and venue hire. | OFF |
| `dashboard` | Dashboard | Cooperative member dashboard with KPIs and analytics. | OFF |
| `admin` | Admin | Platform administration and feature management. | ON |
| `emissions` | Emissions | Our carbon footprint -- tracked, reduced, and offset. | OFF |
| `calendar` | Calendar | Cooperative calendar with events and .ics feed. | ON |
| `federation` | Federation | ActivityPub federation -- discover S/NC creators from the Fediverse. | OFF |
| `streaming` | Streaming | Live streaming powered by Owncast -- watch creators perform live. | OFF |

Production defaults are codified in the `PRODUCTION_DEFAULTS` preset. The `ALL_FEATURES_ON` preset enables every flag and is used for development and testing.

## Configuration

### API side (environment variables)

Each flag maps to a `FEATURE_<FLAG>` env var parsed as a boolean string (`"true"` / `"false"`). In `config.ts`, most flags use a shared `booleanFlag` Zod transformer that defaults to `"true"`:

```ts
const booleanFlag = z.string().default("true").transform((v) => v === "true");
```

Two exceptions -- `FEATURE_FEDERATION` and `FEATURE_STREAMING` -- default to `"false"` because they are off by default even in dev (they require external services).

The validated config is parsed once at import time (`parseConfig(process.env)`), and `getFeatureFlags(config)` produces the `features` singleton used throughout the API.

### Web side (Vite env variables)

Each flag maps to a `VITE_FEATURE_<FLAG>` env var. The `flag()` helper in `apps/web/src/lib/config.ts` defaults absent or empty values to `true`, so all features are ON in local dev without any `.env` configuration. For production builds, set `VITE_FEATURE_<FLAG>=false` for each disabled feature.

### Presets

| Preset | Constant | Use Case |
|--------|----------|----------|
| All ON | `ALL_FEATURES_ON` | Local development, test suites |
| Production | `PRODUCTION_DEFAULTS` | Production deployment, staging |

Both presets are exported from `@snc/shared` and can be used in test helpers or deployment tooling.

## Adding a New Flag

Checklist for adding a feature flag end-to-end:

1. **Add to `FEATURE_FLAGS` array** in `packages/shared/src/features.ts` -- this extends the `FeatureFlag` union type and `FeatureFlags` record type automatically.

2. **Add to both presets** -- set the flag in `ALL_FEATURES_ON` (always `true`) and `PRODUCTION_DEFAULTS` (the intended production state).

3. **Add a `FEATURE_LABELS` entry** -- provide `name` (human-readable, shown in admin UI) and `description` (one sentence explaining what the feature does).

4. **Add API env var** -- add `FEATURE_<FLAG>: booleanFlag` (or a custom default) to `ENV_SCHEMA` in `apps/api/src/config.ts`.

5. **Add to `getFeatureFlags`** -- map the new config field to the flag name in the `getFeatureFlags` function in `apps/api/src/config.ts`.

6. **Add web env var** -- add `<flag>: flag(import.meta.env.VITE_FEATURE_<FLAG>)` to the `features` object in `apps/web/src/lib/config.ts`.

7. **Gate API routes** -- in `apps/api/src/app.ts`, wrap the route mount with `if (features.<flag>)`.

8. **Gate web routes** -- in the route file, use one of two patterns depending on the feature:

   - **Component-level guard** (most routes): check `isFeatureEnabled` at the top of the page component and return `<ComingSoon feature="<flag>" />` if disabled. The loader should also short-circuit and return empty data.
   - **`beforeLoad` redirect** (auth-gated routes like admin, dashboard): call `isFeatureEnabled` in `beforeLoad` and `throw redirect({ to: "/" })` if disabled. This prevents the page from rendering at all.

9. **Rebuild shared** -- run `pnpm --filter @snc/shared build` so downstream packages pick up the new type.

10. **Update tests** -- add the new flag to any test config helpers (e.g., `makeTestConfig` in `apps/api/tests/helpers/test-constants.ts`).

## Gotchas

**API flags default to ON.** The `booleanFlag` Zod transformer defaults to `"true"`, so any unset `FEATURE_*` env var enables its feature. This is intentional for dev ergonomics but means production deployments must explicitly set disabled flags to `"false"`. The two exceptions are `FEATURE_FEDERATION` and `FEATURE_STREAMING`, which default to `"false"` because they require external infrastructure (ActivityPub domain config and Owncast server, respectively).

**Web flags also default to ON.** The `flag()` helper in `apps/web/src/lib/config.ts` returns `true` for absent or empty values. Same rationale: local dev works without any feature flag configuration. Production builds must set `VITE_FEATURE_<FLAG>=false` explicitly.

**Two gating patterns coexist.** Some routes (feed, merch, studio, emissions) use component-level `isFeatureEnabled` checks that render `<ComingSoon>` when disabled. Others (admin, dashboard) use `beforeLoad` redirects. The choice depends on whether the page requires auth -- `beforeLoad` guards prevent the auth check from running at all when the feature is off, avoiding unnecessary server calls.

**API routes vanish when disabled.** Disabled flags cause the entire route group to not be registered in `app.ts`. This means disabled features return 404 (not 403 or a feature-disabled error). Client-side gating should prevent users from hitting these endpoints, but API consumers will see 404s for disabled features.

**Federation loads dynamically.** Unlike other feature-gated routes, federation routes are imported via dynamic `import()` in `app.ts` because `@fedify/fedify` may not be installed. A failed import is caught and logged rather than crashing the server.

**TypeScript enforces completeness.** Because `FeatureFlags` is `Record<FeatureFlag, boolean>`, adding a new entry to `FEATURE_FLAGS` without updating the presets, `getFeatureFlags`, and the web `features` object will produce a type error. The compiler catches incomplete additions.

**`ComingSoon` relies on `FEATURE_LABELS`.** The `ComingSoon` component reads `FEATURE_LABELS[feature]` to display the feature name and description. If you add a flag without a label entry, the component will fail at runtime.
