---
id: e2e-suite-self-rate-limits-auth
tags: [testing]
created: 2026-06-15
---

# E2e global.setup is fragile under rapid reruns — strict auth limiter not env-gated

Surfaced 2026-06-15 while iterating the e2e suite against the live dev stack.

**Note (2026-06-15):** the *recurring* failure first attributed here turned out to
be a separate account-pollution cascade — `auth-flow.spec.ts` leaked a timestamped
account per run, which buried seed users below the admin list's page-20 cutoff and
broke `admin-roles.spec.ts:8`. That has been **fixed** (stable-email register-or-login
in `auth-flow.spec.ts`; the leaked rows were cleaned from the dev DB). The 429s seen
this session were mostly manual `bun -e fetch` probe volume against the same IP, not
the suite alone.

What remains genuinely open is the **latent fragility**, kept here at lower confidence:

## Cause

The strict auth limiter is **not environment-gated** — `apps/api/src/app.ts:74`
applies `rateLimiter({ windowMs: 60_000, max: 10 })` to `/api/auth/sign-in|sign-up|...`
in staging exactly as in prod. The suite shares one client IP; setup does 3 sign-ins
and `auth-flow.spec.ts` adds register + login, so a burst of reruns inside one 60s
window can still approach `max: 10`. A clean cold run passes comfortably — this only
bites under tight rerun cadence or if other auth-heavy specs are added.

Distinct from `security-rate-limit-auth-in-memory` (that item is about the in-memory
store not surviving multi-instance prod; this is the limiter being too tight / ungated
for the e2e+staging profile), but they touch the same middleware.

## Fix directions (not yet designed)

- **Gate the strict limiter by environment** — relax/disable the `max: 10` auth
  limiter under the e2e/staging profile (env check at `app.ts:74`), keeping prod
  tight. Cleanest; mirrors how the suite runs prod feature flags on a staging port.
- **Or** make `global.setup` resilient — retry sign-in on 429 with short backoff so a
  transient throttle doesn't poison the storage states.
- **Or** have setup mint sessions via a single path rather than N per-user HTTP
  sign-ins.

Low urgency now that the pollution cascade is fixed; worth doing before the suite is
wired into CI gating.
