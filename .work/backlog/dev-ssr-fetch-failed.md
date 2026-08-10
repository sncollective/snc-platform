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
