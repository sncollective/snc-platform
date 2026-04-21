---
tags: [testing]
release_binding: null
created: 2026-04-21
---

# Testing: e2e CI hardcoded Origin header in global.setup.ts

`global.setup.ts:19` passes a static `Origin: http://localhost:3082` header (the Caddy staging URL). This works locally but will fail the API's CORS check in CI even after the auth-proxy 404 is fixed, because the CI workflow's `CORS_ORIGIN` is now `http://localhost:3101`.

Fix alongside the auth proxy 404 (tracked separately): either derive Origin dynamically from the current `baseURL`, or use a `WEB_BASE_URL` env var alongside `API_BASE_URL` and use `WEB_BASE_URL` as the Origin value.

Surfaced by typecheck-gap Phase D port change (CI ports 3100/3101), commits `79ee4ea` + submodule `4d93e0b`.
