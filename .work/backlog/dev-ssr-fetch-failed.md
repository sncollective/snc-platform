---
id: dev-ssr-fetch-failed
kind: story
stage: backlog
tags: [developer-experience, web, bug]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-10
updated: 2026-08-10
---

# Dev: web SSR "fetch failed" — can't reach the API from the vite SSR process

The web dev server's SSR cannot fetch the API (`http://localhost:3000`), returning
`[vite] Internal server error: fetch failed` (500) on every SSR'd route (root,
press page, etc.). **Not caused by the press-page-v2 / content-library build** —
the failing fetch path (`fetchAuthStateServer` / `fetchApiServer` in
`apps/web/src/lib/api-server.ts`, called from `__root.tsx` + `index.tsx` loaders)
is unchanged by the build, and the build's tests/typecheck/api are all green.

## The mystery (diagnosed in-session 2026-08-10)
- The API is healthy: `GET http://localhost:3000/api/me` + `/api/creators/animalfuture/press` → **200** from a standalone `node` fetch (and from Liquidsoap).
- The web's vite SSR process specifically **cannot** fetch it — same netns (`/proc/<pid>/ns/net` identical for agent/api/web), no proxy env, `API_INTERNAL_URL=http://localhost:3000` correct, `127.0.0.1`/`::1` variants also fail from the SSR.
- Clearing vite's dep cache (`apps/web/node_modules/.vite`) + restart: no change.
- Console-based debug in `api-server.ts` never surfaced (vite SSR suppresses console); file-based (`appendFileSync` at module load) never wrote → the module-level debug didn't execute in the SSR context (vite SSR module-runner quirk?), so the exact throw cause wasn't captured.

## Likely direction (for focused triage)
- A **Vite 7 SSR module-runner / sandbox** quirk: the SSR evaluates modules in a context where the global `fetch` can't open connections, even though the host process can. Investigate the vite config's SSR environment (`ssr.noExternal`, the module runner, worker-based SSR), and whether the fetch is node's global undici or a sandboxed one.
- Consider disabling SSR (client-side render) as an interim verification unblock, OR routing the SSR fetch through a path that works (Caddy :3080? a node http instead of fetch?).
- Capture the real error: a vite-plugin or error-boundary that logs the SSR error stack to a file (vite's overlay + pm2 logs strip it).

## Why parked, not fixed inline
Pre-existing dev-env issue, unrelated to the verified build; deep vite-SSR triage is its own thread. The build itself is green (api unit 2011, web 1905, typechecks 0; the API serves the press/PDF endpoints 200). Blocks live *web* verification until resolved; *API* surfaces (PDFs, press content) verify fine directly.

## Bisect update (2026-08-10) — audit-gate deps RULED OUT
Hypothesis (prior session's audit-gate dep bumps broke it) tested by reverting each:
- **undici ^8.9.0** → reverted (node bundled undici): still failed. Not the culprit.
- **@hono/node-server ^2.0.5** → reverted to ^1: still failed. Not the culprit.
- **vite ^7.3.5** → **not revertible**: `@tanstack/react-start` requires `vite >=7.0.0` (peer dep). The prior session's vite-*8* force was already reverted to 7 (commit 11dc43f), so vite-7 is the baseline, not an audit-gate bump.

Deps restored to the committed audit-gate versions after the bisect.

## Where the throw actually originates (key finding)
The "fetch failed" is **NOT** in the app's explicit fetches — instrumented `fetchApiServer` + `fetchAuthStateServer` (in `apps/web/src/lib/api-server.ts`) with file-write try/catches: **neither fired**. So the throw is in the **TanStack Start / vite-7 dev SSR transport** (the dev-mode server-fn/RPC machinery), not app code. Vite strips `error.cause` from its overlay + pm2 logs, so the exact cause (ECONNREFUSED? a dev-RPC endpoint?) wasn't captured.

## Next triage direction (for whoever picks this up)
- Capture `error.cause` via a **vite plugin** (`configureServer`/SSR error hook) that writes the full error to a file — bypasses vite's overlay/log stripping.
- Investigate the TanStack Start dev-mode server-fn transport: does it route SSR server-fn calls through an internal RPC fetch in dev? If so, where does that fetch go + why does it fail?
- Check if the break correlates with a **docker / devcontainer network change** around Aug 7 23:50 (the dev services are stable now, but the timing is the only lead left after the deps were ruled out). Note: the web-error.log's first entry is Aug 7 23:50, which might be log-start, not the true break time.
- Interim unblock (not a fix): disable SSR + use the vite proxy (`VITE_API_URL`) for client-side verification.

## Status
Parked per operator (2026-08-10). The press-page-v2 + content-library build is verified green independently of this (api unit 2011, web 1905, typechecks 0, API serves press/PDF endpoints 200). This blocks live *web* verification only.
