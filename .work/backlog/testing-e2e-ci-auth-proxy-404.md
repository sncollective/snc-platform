---
tags: [testing]
release_binding: null
created: 2026-04-20
---

# Testing: e2e CI auth setup proxy 404 (blocks entire suite)

`global.setup.ts:17` posts to `/api/auth/sign-in/email` relative to Playwright's `baseURL`. In CI, `baseURL` is `http://localhost:3101` (the Vite web dev server). Vite has no `/api/*` proxy in CI (no Caddy), so the request hits Vite's router and returns a 404 SSR page. Locally this works because `baseURL` is the Caddy staging URL `http://localhost:3082`, which proxies `/api/*` to the API.

This failure blocks the entire e2e suite — all 108 tests in `chromium` and `mobile` projects do not run because they depend on the setup project.

Two options:
- (a) Add a `server.proxy` entry in Vite dev config that forwards `/api/*` to `http://localhost:3100`, gated by an env var, so CI's web server proxies auth requests.
- (b) Add an `API_BASE_URL` env var threaded into `global.setup.ts` so auth POSTs bypass Vite entirely and go directly to the API. Pass via `playwright.config.ts` and set `API_BASE_URL: http://localhost:3100` in the CI workflow.

Option (b) is cleaner — it decouples setup from the Vite proxy and makes the auth endpoint explicit. Fix alongside the hardcoded Origin header (tracked separately).

Surfaced by typecheck-gap Phase D port change (CI ports 3100/3101), commits `79ee4ea` + submodule `4d93e0b`.
