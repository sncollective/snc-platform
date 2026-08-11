# Session: dev SSR "fetch failed" — root-caused + fixed (undici 7↔8 skew), drift guard added

**Date:** 2026-08-11
**Scope:** platform dev environment — the blocked-from-testing-in-dev SSR failure
(`.work/active/stories/dev-ssr-fetch-failed.md`).

## The bug
Every SSR'd web route returned `[vite] Internal server error: fetch failed` (500)
in dev. The API was healthy (standalone `node` fetch → 200); only the vite/Nitro
SSR path failed. Blocked all live web verification.

## Root cause (definitive)
A **major-version skew between the installed `undici` and Node's bundled
`undici`**:
- Node 24.18.1 **bundles undici 7.29.0** (the global `fetch` + default dispatcher).
- Root `package.json` `resolutions` pinned **`undici: ^8.9.0`** (→ 8.10.0), from
  commit `f62a722` (Aug 7, "clear audit advisories"). That override forced undici
  8.x onto **Nitro** (declares `^7.18.2`; its SSR worker `node-runner.mjs` does
  `import { Agent } from "undici"`).
- **undici 8.0 is a breaking major** — it changed the Dispatcher Interceptor
  `onRequestStart` contract. A fetch dispatched across the 7↔8 boundary throws
  `InvalidArgumentError "invalid onRequestStart method"`, which Vite flattens to
  a generic `fetch failed` and **strips `error.cause`** — exactly why the prior
  session couldn't see it. Timing matches: web-error.log's first failure is
  Aug 7 23:50.

### Why the prior session's bisect missed it
It "reverted undici ^8.9.0" by removing a **direct** undici dep, but the **root
`resolutions` override survived**, so the override kept forcing 8.x onto Nitro.
The lever was the workspace-level resolution, not any one package's declared dep.

### The capture technique (reusable)
Vite strips `error.cause` from its overlay + pm2 logs. A throwaway
`configureServer` plugin that hooks `server.config.logger.error` **before** it
formats, dumping the full error (cause + stack) to a file, surfaced the real
`InvalidArgumentError`. Future vite-SSR "fetch failed"/opaque-cause debugging:
hook the logger, don't chase the strip. (The web app handlers are all `.catch()`-
wrapped → render empty/guest, not 500; so a 500 always means the throw is in the
transport/dispatch layer, not app fetch code.)

## The fix
`platform/package.json`: `undici: ^8.9.0 → ^7.18.2` (→ 7.29.0, matching Node's
bundled major). `bun install --force`. Lockfile diff is undici-only.
**`bun audit` reports no undici advisory**, so this reintroduces nothing.

Verified: SSR `GET /` → 200 (was 500), `GET /creators/animalfuture/press` → 200,
zero `fetch failed` post-restart. web typecheck 0; web test 1909 pass (1 media-
picker failure passes in isolation — pre-existing flake). Commit `75be8f0`.

## Drift guard
`scripts/dev/check-undici-alignment.mjs` asserts Node's bundled undici major
(`process.versions.undici`) matches the undici Nitro's SSR worker resolves;
wired into `start-dev.sh` (step 0) so a container rebuild that bumps Node fails
loud with the fix instead of silently serving 500s. Both branches verified (OK →
exit 0; drift → exit 1 + actionable message). Commit `bd7b6a9`.

**Invariant:** installed undici major must match Node's bundled undici major
(Node 24 → 7.x; Node 26 → 8.x). Stay on Node 24 LTS through launch; a Node bump
must bundle the matching undici resolution bump.

## Carry-forwards
- **Parent submodule pointer bump (pending — via SNC):** platform pointer
  `a2abdba0` → `bd7b6a9` (89 commits: the whole press-page-v2 + content-library
  build + this fix + drift guard). Platform pushed to origin this session.
- **CI wiring (pending — via SNC):** add `node platform/scripts/dev/check-undici-
  alignment.mjs` to `.forgejo/workflows/platform-test-and-build.yml` (after
  install, before tests) so drift is caught in automation.
- **media-picker.test.tsx** is an order-dependent flake (passes alone, fails in
  full suite) — worth its own look.
- Node is pinned to major `24` in both devcontainers (not `lts`) → rebuilds
  follow 24.x patches but won't silently jump to 26. Good.
