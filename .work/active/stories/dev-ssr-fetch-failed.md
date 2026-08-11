---
id: dev-ssr-fetch-failed
kind: story
stage: done
tags: [developer-experience, web, bug]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-10
updated: 2026-08-11
---

# Dev: web SSR "fetch failed" — FIXED (undici 7↔8 major-version skew)

## Symptom
The web dev server's SSR returned `[vite] Internal server error: fetch failed`
(500) on every SSR'd route (root, press page, etc.), blocking live web
verification in dev. The API itself was healthy — a standalone `node` fetch to
`http://127.0.0.1:3000/api/me` returned 200 — only the vite/Nitro SSR path
failed.

## Root cause (definitive — captured 2026-08-11)
A **major-version skew between the installed `undici` and Node's bundled
`undici`**, introduced by a root `resolutions` override and never fully reverted.

- Node 24.18.1 **bundles undici 7.29.0** (the global `fetch` + default dispatcher).
- The root `package.json` `resolutions` pinned **`"undici": "^8.9.0"`** (commit
  `f62a722`, Aug 7 — "clear audit advisories"), resolving to **undici 8.10.0**.
- That override forced undici 8.x onto **Nitro** (which declares `undici: ^7.18.2`
  and imports `Agent` from `undici` in its SSR worker, `node-runner.mjs`).
- **undici 8.0 is a breaking major** (the package ships a
  `migrating-from-v7-to-v8.md`); it changed the Dispatcher/Interceptor
  `onRequestStart` contract. A fetch dispatched across the 7↔8 boundary throws
  `InvalidArgumentError: invalid onRequestStart method (UND_ERR_INVALID_ARG)`.
- Vite wraps that as a generic `TypeError: fetch failed` and **strips
  `error.cause`** from its overlay + pm2 logs — which is why the prior session
  couldn't see the real cause and the throw appeared to be "in the transport."

The break's timing matches exactly: web-error.log's first `fetch failed` entry is
**Aug 7 23:50**, the same day commit `f62a722` landed.

### Why the prior session's bisect missed it
The prior session "reverted undici ^8.9.0" by removing a **direct** undici
dependency, but the **root `resolutions."undici": "^8.9.0"` survived** — so the
override kept forcing 8.10.0 onto Nitro and the failure persisted. Reverting
undici / @hono/node-server / vite individually was inconclusive for the same
reason: the real lever was the workspace-level resolution, not any one package's
declared dep.

## The fix
`platform/package.json` resolution `undici: ^8.9.0 → ^7.18.2` (resolves to
7.29.0, same major as — and the exact version Node 24.18.1 bundles). `bun install
--force` relinked; the lockfile diff is undici-only (8.10.0 → 7.29.0, two lines).

This reintroduces **no advisory** — `bun audit` currently reports zero undici
advisories (the remaining advisories are @babel/core, @tanstack/start-server-core,
image-size, nanoid). The `^8.9.0` override was clearing an advisory that no longer
exists.

## How the cause was captured
Vite strips `error.cause`, so a temporary `configureServer` plugin hooked Vite's
logger (`server.config.logger.error`) *before* formatting and dumped the full
error to a file. That surfaced the real cause:
`InvalidArgumentError "invalid onRequestStart method" (UND_ERR_INVALID_ARG)` —
pointing straight at the undici dispatcher contract. (Instrumentation removed
after diagnosis; `vite.config.ts` is unchanged from HEAD.)

## Verification (machine-proven — dev-env surface)
- `GET http://127.0.0.1:3001/` (root, SSR) → **200** (was 500).
- `GET http://127.0.0.1:3001/creators/animalfuture/press` (SSR + real API hit) → **200**.
- web-error.log: zero `[vite] Internal server error: fetch failed` since restart.
- `@snc/web typecheck`: 0 errors. `@snc/web test`: 1909 passed, 1 failed — the
  lone failure (`media-picker.test.tsx`) **passes in isolation (11/11)** → a
  pre-existing order-dependent flake, not caused by this dep change.

## Invariant to preserve (for future Node / undici bumps)
**The installed `undici` major version must match Node's bundled `undici` major.**
Node 24.x bundles undici 7.x → keep the resolution on `^7.x`. When the project
moves to a Node line that bundles undici 8.x, bump the resolution to match. A
mismatch resurfaces this exact `onRequestStart` failure.

**Enforced:** `scripts/dev/check-undici-alignment.mjs` compares
`process.versions.undici`'s major to the undici Nitro's SSR worker resolves, and
is wired into `start-dev.sh` (step 0) so a container rebuild that bumps Node
fails loud with the exact fix instead of silently serving 500s. (Not yet wired
into CI — `.forgejo/workflows/platform-test-and-build.yml` in the parent repo is
the place to add it.)

## Status
`stage: done`, unbound to a release (dev-environment fix). Dev web verification
is unblocked.
