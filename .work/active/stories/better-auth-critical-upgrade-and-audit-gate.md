---
id: better-auth-critical-upgrade-and-audit-gate
kind: story
stage: done
tags: [security, identity, developer-experience]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-07-16
updated: 2026-07-17
resolved_at: 2026-07-17
resolved_by: "f620e6c, 04593ce"
---

# Upgrade better-auth (critical CVE) and decide the bun-audit gate posture

## Brief

The `test-shared` job in `platform-test-and-build.yml` fails because `bun audit
--audit-level=high` exits 1 against 20 vulnerabilities (1 critical, 19 high). The
critical is a real product security issue: **better-auth <1.6.11** is vulnerable to
**OAuth refresh-token replay via missing client authentication on oidc-provider and
mcp plugins** (GHSA-pw9m-5jxm-xr6h). The platform pins `"better-auth": "^1.6.0"`
(resolves to a 1.6.x below the fixed 1.6.11) across `@snc/api`, `@snc/e2e`, and
`@snc/web`.

This story covers two coupled concerns: (1) the better-auth upgrade that clears the
critical, and (2) the audit-gate policy decision that determines whether `high`-level
advisories block CI.

**Surfaced triaging Forgejo run 97** (test-shared job, task 465).

## The critical (must fix)

- **Advisory:** GHSA-pw9m-5jxm-xr6h — Better Auth: OAuth refresh-token replay via
  missing client authentication on oidc-provider and mcp plugins.
- **Affected:** `better-auth >=1.6.0 <1.6.11`.
- **Current pin:** `"better-auth": "^1.6.0"` in `apps/api/package.json` (also
  `@snc/e2e`, `@snc/web`).
- **Fix:** bump to `>=1.6.11` (latest 1.6.x recommended). Verify the oidc-provider /
  mcp plugin surfaces still behave — refresh-token replay is a session/auth flow, so
  integration tests + manual auth-flow check apply.

Associated high-severity better-auth advisories in the same range (likely cleared by
the same upgrade): GHSA-7w99-5wm4-3g79 (OAuth auth-code concurrent redemption),
GHSA-9h47-pqcx-hjr4 (insecure crypto defaults in oidcProvider), GHSA-86j7-9j95-vpqj
(stored XSS via javascript: redirect_uri), GHSA-g38m-r43w-p2q7 (account takeover via
OAuth auto-link), GHSA-fmh4-wcc4-5jm3 (unauthorized invitation acceptance),
GHSA-cq3f-vc6p-68fh (device auth approve/deny accepts any session).

## The audit-gate policy (needs a decision)

`bun audit --audit-level=high` is doing what it's configured to do — it's correctly
flagging real advisories, and the `high` level makes CI fail on them. The question is
whether `high` is the right gate level for this project's stage. Options:

1. **Keep `high` (current).** CI stays red until the 19 highs are resolved. Most
   are transitive deps (hono, undici, kysely, vite, ws, nodemailer, @fedify/*,
   fast-xml-builder) that clear via `bun update`. Forces hygiene but can block
   unrelated work. **Recommended once the better-auth critical is cleared** —
   run `bun update` to knock out the transitively-fixable highs, then re-assess.
2. **Soften to `--audit-level=critical`.** Lets highs through; blocks criticals
   only. Pragmatic for pre-1.0 velocity but kicks the can on real advisories.
3. **Split the gate.** Keep the audit step informational (`|| true`, or move to a
   separate `audit` job that warns) and enforce at release time via the
   `gate-security` release gate instead of per-commit. Decouples advisory triage
   from the test/build signal.

This is a security-policy call. The agent's recommendation is **option 1**: clear
the critical via the better-auth upgrade, run `bun update` for the transitive highs,
and keep the `high` gate. But this is the operator's decision — the audit gate
shouldn't be silently loosened to make CI green.

## Design

1. **Upgrade better-auth** to `>=1.6.11` across `apps/api`, `@snc/e2e`, `@snc/web`
   (check whether the pin lives in each package or a workspace root). Run
   `bun install`, then `bun run --filter @snc/api test:unit` to catch regressions
   in auth/session flows.
2. **Run `bun update`** to clear transitively-fixable highs. Re-run
   `bun audit --audit-level=high` and see what remains.
3. **Decide the gate posture** per the options above. If keeping `high`, any
   remaining advisories after `bun update` each need a triage decision (fix, pin,
   or document-and-defer).
4. **Verify** `test-shared` goes green on the next CI dispatch.

## Verification

- `bun audit --audit-level=high` exits 0 (or the gate is explicitly re-leveled per
  the decision).
- `bun run --filter @snc/api test:unit` passes — auth/session tests still green
  after the better-auth bump.
- Manual: a login + token-refresh round-trip in the dev env confirms the OAuth
  refresh flow still works post-upgrade (the critical was in that path).

## Simplification opportunity

If the audit gate moves to release-time (`gate-security`) instead of per-commit, the
`test-shared` job's `bun audit` step becomes informational and stops blocking
unrelated CI work — a cleaner separation of "is the code sound" (tests/typecheck)
from "are the deps current" (audit). Worth considering as part of the gate decision.

<!-- Implementation notes accumulate here when this story is picked up. -->

## Implementation notes

- 2026-07-16 (`f620e6c`): bumped better-auth `^1.5.4` → `~1.6.23` across api/e2e/web.
  Cleared the critical (GHSA-pw9m-5jxm-xr6h) and the better-auth-associated highs.
  Audit: 20 vulns (1 crit, 19 high) → 9 high.
- 2026-07-17 (`04593ce`): cleared the remaining 8 highs via direct pin bumps
  (hono `^4.12.30`, vite `^8.1.5`, @fedify/fedify `^2.1.15`, nodemailer `^9.0.3`)
  and root `resolutions` overrides for transitive copies (undici `^8.7.0`, ws
  `^8.21.0`, fast-xml-builder `^1.1.7`). Audit: 0 high (8 low/moderate residual).
  The audit-gate policy decision resolved as option 1 (keep `high`, clear via
  bumps) — `bun audit --audit-level=high` now exits 0.
- nodemailer 8→9 was the one major bump; breaking change (TLS cert validation on
  remote content fetches) verified non-impacting — `send.ts` is a plain transport
  with no remote attachment/proxy/OAuth2 use. Email tests green (send 5/5,
  studio.routes 8/8, notification-send 4/4, send-otp-email 4/4).
