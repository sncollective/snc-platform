---
id: e2e-harness-determinism
kind: feature
stage: review
tags: [testing, developer-experience]
parent: machine-verifiable-testing
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-26
updated: 2026-06-28
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

## Design decisions

- **Black-box boundary:** allow test-control APIs only for setup/reset/seed and machine probes; keep
  product assertions browser-facing. This follows the parent epic and `.work/CONVENTIONS.md` update.
- **Isolation spine:** build a narrow e2e-only test-control surface first, then prove it by converting
  creator-programming pool mutations off UI reset + serial/chromium-only partitioning.
- **Clock/randomness:** prefer explicit fixture IDs/timestamps and Playwright clock controls over
  invasive production time abstractions; production code must not depend on test clocks.
- **Artifacts and vision:** trace/video/screenshot + triage output are the durable default; vision is
  a post-run debugging aid, never a CI gate.
- **Auth limiter:** use an explicit e2e/test-profile gate, not a broad staging relaxation, so production
  strictness remains structurally tested.

## Mock-boundary plan

No new external service mock is introduced by this feature. The e2e suite continues to run against the
real local/staging service stack (API, web, Postgres, Garage/S3-compatible storage, and streaming
services where relevant). The new test-control surface is an e2e-only setup adapter, not a mocked
replacement for product behavior. Product assertions remain UI-facing; setup/reset/seed and runtime
machine probes are allowed support surfaces.

## Taxonomy plan

- **Golden:** isolation proof converts the existing creator-programming mutation journey to clean-slate
  parallel-safe setup.
- **Failure mode:** auth limiter tests prove the strict production/default path remains strict while the
  e2e profile is relaxed; test-control routes fail closed outside the explicit profile.
- **Chaos:** not included here — no retry/fallback behavior is introduced by the harness itself.
- **Fuzz:** not applicable — no parser or serializer surface is added.

## Implementation units

### Unit 1: Test-control reset/seed API

**Story:** `e2e-harness-determinism-test-control-api`

**Files:**
- `apps/api/src/routes/test-control.routes.ts`
- `apps/api/src/services/test-control.ts`
- `apps/api/src/app.ts`
- `apps/api/src/config.ts`
- `apps/e2e/tests/helpers/test-control.ts`

**Invariant:** e2e setup can reset/seed deterministic fixture state through an explicitly gated support
surface, while production/default runtime cannot reach that surface.

**Acceptance criteria:** see child story.

### Unit 2: Parallel-safe isolation proof

**Story:** `e2e-harness-determinism-isolation-proof`
**Depends on:** `e2e-harness-determinism-test-control-api`

**Files:**
- `apps/e2e/tests/creator-programming.spec.ts`
- `apps/e2e/tests/helpers/test-control.ts`
- `apps/e2e/playwright.config.ts`

**Invariant:** creator-programming pool-mutating specs start from deterministic clean state without UI
surgery and no longer require serial/chromium-only partitioning.

### Unit 3: Clock and seed control

**Story:** `e2e-harness-determinism-clock-seed-control`

**Files:**
- `apps/e2e/tests/helpers/determinism.ts`
- `apps/e2e/global.setup.ts`
- `apps/api/src/services/test-control.ts`

**Invariant:** e2e fixtures use deterministic IDs/timestamps and browser-visible time assertions can opt
into a fixed clock without changing production behavior.

**Convention:** use `apps/e2e/tests/helpers/determinism.ts` for `stableTestId`, seeded suffixes,
`E2E_FIXED_FIXTURE_TIMESTAMP_ISO`, and opt-in `installFixedClock(page)` before navigation when a
spec asserts browser-visible date/time text.

### Unit 4: Artifacts, triage output, and flake policy

**Story:** `e2e-harness-determinism-artifacts-triage`

**Files:**
- `apps/e2e/playwright.config.ts`
- `apps/e2e/tests/helpers/triage.ts` or a Playwright reporter hook
- `apps/e2e/README.md` or the closest existing e2e documentation home

**Invariant:** a failed e2e run leaves enough machine-readable evidence for an agent to triage before
asking a human to eyeball the app.

### Unit 5: Auth limiter e2e-profile gate

**Story:** `e2e-harness-determinism-auth-limiter-gate`

**Files:**
- `apps/api/src/config.ts`
- `apps/api/src/app.ts`
- `apps/api/src/middleware/rate-limit.ts`
- `apps/e2e/playwright.config.ts`
- `apps/e2e/global.setup.ts`

**Invariant:** rapid e2e retries do not self-throttle auth setup, while production/default auth limits
remain strict.

## Implementation order

1. `e2e-harness-determinism-test-control-api`
2. `e2e-harness-determinism-isolation-proof`
3. `e2e-harness-determinism-clock-seed-control`
4. `e2e-harness-determinism-artifacts-triage`
5. `e2e-harness-determinism-auth-limiter-gate`

Units 3–5 are independent of the reset/seed API and can run in parallel after design, but Unit 2 must
wait for Unit 1.

## Risks

- The test-control API is the sharpest edge: it must fail closed outside the explicit e2e profile and
  must not become a general product backdoor.
- Converting creator-programming mutations may expose hidden coupling to the demo seed; use prefixed
  fixtures and cleanup rather than deleting broad demo state.
- Artifact retention can balloon CI storage; keep video/trace retention bounded to failures/retries.
- The auth limiter fix must not weaken production or mask `security-rate-limit-auth-in-memory`, which
  is a separate production-scaling concern.

## Backlog absorption

Backlog item `e2e-suite-self-rate-limits-auth` is absorbed into
`e2e-harness-determinism-auth-limiter-gate`; the original backlog note identified latent fragility
under tight rerun cadence and is now represented by the active child story.

## Children complete (2026-06-28)

All child stories reached `stage: done`: test-control reset/seed API, parallel-safe isolation proof,
clock/seed control, artifact triage, and auth limiter gating. Feature is ready for review.

## Review findings (2026-06-28)

Fresh-context feature review requested changes: the default local/staging e2e path used the PM2 API
without `AUTH_RATE_LIMIT_PROFILE=e2e` / `TEST_CONTROL_PROFILE=e2e`, so `bun run --filter @snc/e2e test`
would not have the same deterministic setup surface as CI. Fixed by adding the explicit e2e-only
profiles to `ecosystem.config.cjs` for the dev API process and documenting the local/CI profile parity
in `AGENTS.md` and `apps/e2e/README.md`. Verification: `pm2 restart api --update-env`,
`bun run --filter @snc/e2e test -- --list tests/creator-programming.spec.ts`, and direct
`/api/test-control/status` probe returned `200 {"ok":true,"profile":"e2e"}`.
