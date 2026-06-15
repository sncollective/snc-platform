---
id: e2e-suite-self-rate-limits-auth
tags: [testing]
created: 2026-06-15
---

# E2e suite can rate-limit its own auth and fail global setup with 429

Surfaced 2026-06-15 while iterating the e2e suite against the live dev stack.
After several back-to-back full-suite runs (plus ad-hoc auth probes), `global.setup`
started failing with **429 RATE_LIMIT_EXCEEDED** on `/api/auth/sign-in/email`,
which poisons the shared auth storage states and cascades into the first
auth-dependent test (`admin-roles.spec.ts:8` "loads user list").

## Cause

The strict auth limiter is **not environment-gated** — `apps/api/src/app.ts:74`
applies `rateLimiter({ windowMs: 60_000, max: 10 })` to `/api/auth/sign-in|sign-up|...`
in staging exactly as in prod. The whole suite shares one client IP, and within a
60s window the suite's own auth volume (setup does 3 sign-ins; `auth-flow.spec.ts`
adds register + 2 logins; reruns stack) exceeds `max: 10`. A single cold sign-in
returns 200 — this only bites under suite-level concurrency / rapid reruns.

This is distinct from `security-rate-limit-auth-in-memory` (that item is about the
in-memory store not surviving multi-instance prod; this is about the limiter being
too tight / ungated for the e2e+staging environment), but they touch the same
middleware and could be addressed together.

## Fix directions (not yet designed)

- **Gate the strict limiter by environment** — relax or disable the `max: 10` auth
  limiter when running under the e2e/staging profile (a feature-flag / env check at
  `app.ts:74`), keeping prod tight. Cleanest; mirrors how the suite already runs
  with prod feature flags but a staging port.
- **Or** make `global.setup` resilient — retry sign-in on 429 with a short backoff so
  transient throttling doesn't poison the storage states.
- **Or** have setup log in via a single token-minting path rather than N per-user
  HTTP sign-ins.

Low urgency (the suite passes from a cold limiter), but it makes rapid local iteration
flaky and should be fixed before the suite is wired into CI gating.
