---
id: e2e-harness-determinism
kind: feature
stage: drafting
tags: [testing, developer-experience]
parent: machine-verifiable-testing
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-26
updated: 2026-06-26
---

# E2E harness: determinism, isolation, and triage

## Brief

The engineering that makes rung 3 (e2e) the *default* close-condition at scale — the harness
that lets new coverage specs be machine-verified without flake, serial bottlenecks, or human
triage. **Sequenced ahead of the ~9 feature coverage specs in backlog** (`testing-creator-*-e2e`,
`testing-invite-flow-e2e`, etc.): adding those specs on top of today's shared-DB + UI-reset model
multiplies the flake surface, so the harness lands first.

This feature collects the "harness-light" gap the adversarial review flagged: the backlog is
coverage-heavy but missing the machinery that makes coverage cheap and trustworthy.

## Component arcs (to be decomposed at design)

1. **Deterministic test-control reset/seed API.** The e2e suite resets state via UI surgery
   (`creator-programming.spec.ts` `resetMayaProgramming()`) because writes persist in the shared
   demo DB, forcing serial + chromium-only partitioning for pool-mutating cases
   (`creator-programming.spec.ts:160`). Adopt the pattern the **integration suite already uses**:
   prefixed fixtures + a `cleanupFixtures()` clean-slate in `beforeEach`/`afterEach`
   (`apps/api/tests/integration/creator-playout/cross-tenant-isolation.test.ts:42,59,241`),
   exposed as a **test-control API** the e2e harness can call (allowed under the reframed
   black-box boundary — it is setup, not a product assertion). Goal: new specs get a clean slate
   per test and **drop the serial/chromium-only partitioning**, running parallel-safe.

2. **Clock / seed determinism control.** A way to pin time and randomness for e2e so specs that
   touch dates/ordering/tokens don't flake on wall-clock or RNG.

3. **Playwright artifact retention + agent-readable failure triage.** Today `playwright.config.ts:44`
   keeps trace only on first-retry, screenshot only-on-failure, **no video**. Add trace + video
   retention and a machine-readable failure-triage output so a failing spec is diagnosed by the
   agent first, not eyeballed by a human. (This is also where the L4 vision capability plugs in as
   *triage*, not a gate.)

4. **Flake quarantine / rerun policy.** A defined policy for quarantining and re-running flaky
   specs so a flake doesn't either block CI or get silently deleted — root-caused, tracked, gated.

5. **Env-gate the strict auth limiter for e2e/staging** (absorbs backlog
   `e2e-suite-self-rate-limits-auth`). The strict auth limiter is not env-gated
   (`apps/api/src/app.ts:74` applies `max: 10` in staging as in prod); the shared-IP suite can
   approach the cap under rapid rerun. Relax/disable under the e2e/staging profile (keeping prod
   tight) or make `global.setup` 429-resilient. Worth doing before the suite is CI-gated.

## Acceptance

- A test-control reset/seed path exists; at least one previously serial/chromium-only spec is
  converted to parallel-safe clean-slate isolation as the proof case.
- Clock/seed control is available to e2e specs.
- Failed e2e runs retain trace+video and emit agent-readable triage; flake policy documented.
- The strict auth limiter no longer threatens the suite under rerun cadence.

## Notes

Decompose into child stories at `feature-design` with `depends_on` chains (the reset/seed API is
the spine; isolation conversion depends on it). Component 5 absorbs an existing backlog item —
`git rm` it on decomposition and note the absorption.
