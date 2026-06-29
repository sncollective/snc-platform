# 2026-06-28 — Machine-verifiable testing autopilot drain in progress

## Scope

Continued agile-workflow autopilot over `machine-verifiable-testing`, focusing on converting the
verification philosophy scoped on 2026-06-26 into concrete substrate progress. This note is a bank
point at ~68% context while two agents are still running.

## Completed and committed

### Convention carve-out

- `convention-machine-proof-carveout` reached `stage: done`.
- `.work/CONVENTIONS.md` now says fix-verify loopback is conditional: human confirmation is required
  only where no deterministic machine proof exists; residual human checks carry a paired backlog item
  with expiry; prod-only checks stay in `## Prod verification`.
- `AGENTS.md` was updated after fresh-context review caught that it still carried the old unconditional
  loopback wording.
- Commits:
  - `bdb8e62 prose-author: convention-machine-proof-carveout`
  - `7389278 implement: convention-machine-proof-carveout`
  - `111c4cf fix review: convention-machine-proof-carveout`
  - `5c9ba7b review: convention-machine-proof-carveout (approve)`

### E2E harness determinism

`e2e-harness-determinism` was designed and all five children reached `done`; the parent is now at
`stage: review` with a fresh-context reviewer running.

Children completed:

- `e2e-harness-determinism-auth-limiter-gate` — explicit `AUTH_RATE_LIMIT_PROFILE=e2e` relaxation for
  e2e while production/default remains strict.
- `e2e-harness-determinism-artifacts-triage` — bounded trace/video/screenshot retention, triage
  reporter emitting `test-results/triage.json` + `.md`, e2e README flake policy, L4 vision explicitly
  triage-only.
- `e2e-harness-determinism-test-control-api` — e2e-only test-control reset/seed API + Playwright
  helper, gated off by default. Review repaired the integration test to seed its own Maya prerequisite
  rows with `onConflictDoNothing`; after starting dev services and running `db:migrate`,
  `test-control-service.test.ts` passed.
- `e2e-harness-determinism-clock-seed-control` — deterministic suffix/fixture ID/timestamp helpers,
  opt-in Playwright fixed clock, `@snc/e2e typecheck` script.
- `e2e-harness-determinism-isolation-proof` — creator-programming mutation specs converted off UI
  surgery and serial/chromium-only partitioning. Verification passed across chromium + mobile with
  test-control setup.

Key commits:

- `ffe9fce e2e-test-design: e2e-harness-determinism (5 child stories)`
- `e9d358d implement: e2e-harness-determinism-auth-limiter-gate`
- `6e6f668 review: e2e-harness-determinism-auth-limiter-gate (approve)`
- `4f0283f implement: e2e-harness-determinism-artifacts-triage`
- `a5ab771 review: e2e-harness-determinism-artifacts-triage (approve)`
- `18492f7 implement: e2e-harness-determinism-test-control-api`
- `46b2c9a review: e2e-harness-determinism-test-control-api (approve)`
- `7f84dde implement: e2e-harness-determinism-clock-seed-control`
- `61c9c1e review: e2e-harness-determinism-clock-seed-control (approve)`
- `f609c8b implement: e2e-harness-determinism-isolation-proof`
- `d05e9fa review: e2e-harness-determinism-isolation-proof (approve)`

### Creator-channel engine e2e infra

`creator-channel-engine-e2e-infra` was promoted from story to feature after design discovery showed it
needed topology, prefetch, and machine-proof stories. Current feature stage is `implementing` because
one child remains active.

Completed children:

- `creator-channel-engine-e2e-infra-topology` — default Liquidsoap config still excludes creator
  `live-ingest` channels; explicit e2e profile includes selected creator channels as queue-capable
  outputs; non-broadcast live RTMP listener remains deferred.
- `creator-channel-engine-e2e-infra-prefetch` — e2e-profile startup/prefetch support for selected
  creator channels through the shared orchestrator; default startup still initializes ordinary playout
  channels only.

Key commits:

- `b375770 feature-design: creator-channel-engine-e2e-infra (3 child stories)`
- `a181575 implement: creator-channel-engine-e2e-infra-topology`
- `9a22278 review: creator-channel-engine-e2e-infra-topology (approve)`
- `6720593 implement: creator-channel-engine-e2e-infra-prefetch`
- `b98d5b1 review: creator-channel-engine-e2e-infra-prefetch (approve)`

## Running agents / latest status update

No subagents are currently running as of the later bank update.

Completed after the initial bank:

- `2d8e670b-b86e-4f2` reviewed `e2e-harness-determinism`, requested one blocker: local PM2/staging e2e did not enable `AUTH_RATE_LIMIT_PROFILE=e2e` / `TEST_CONTROL_PROFILE=e2e`. Fixed in `edb77cf` by setting those profiles in `ecosystem.config.cjs` and documenting them in `AGENTS.md` + `apps/e2e/README.md`. Re-review `23b9ff3c-ff2c-451` approved; parent feature closed in `f314b31`.
- `a445f14b-1383-415` implemented `creator-channel-engine-e2e-infra-machine-proof` in `c710e57`, but correctly left the story at `stage: implementing`: spec discovery passed, but the real L1-L2 proof did not. CI-profile run queued Maya content successfully, then `nowPlaying.contentId` stayed `null` for 90s. A later speculative retry to restart Liquidsoap on e2e-profile API startup failed earlier in auth setup while API logs showed stale Liquidsoap `/pool/next` channel IDs and SRS callback rate limits; that speculative code was reverted. The story body now records this.

## Current substrate snapshot

Top-level `machine-verifiable-testing` children:

- `convention-machine-proof-carveout` — `done`
- `e2e-harness-determinism` — `done`
- `creator-channel-engine-e2e-infra` — `implementing`
- `e2e-browser-decode-playback-proof` — `drafting`, depends on infra
- `e2e-agent-vision-pixel-inspection` — `drafting`, depends on infra + browser decode

`e2e-harness-determinism` children are all `done`.

`creator-channel-engine-e2e-infra` children:

- `creator-channel-engine-e2e-infra-topology` — `done`
- `creator-channel-engine-e2e-infra-prefetch` — `done`
- `creator-channel-engine-e2e-infra-machine-proof` — `implementing` (worker finished; proof failing on real media-stack signal)

## Environment / caveats

- Dev services were started via `bash scripts/dev/start-dev.sh` and migrations applied via
  `bun run --filter @snc/api db:migrate` to unblock integration verification.
- PM2 API/web/web-staging are online as of the bank point.
- Unrelated untracked files remain and should not be touched unless the user explicitly asks:
  - `.pi/`
  - `publicity-advisor-brief.pdf`
  - `scripts/dev/sandbox-test-e2e.sh`

## Next logical steps

1. Diagnose `creator-channel-engine-e2e-infra-machine-proof` failure. Start from API logs showing Liquidsoap `/pool/next` calls for stale/nonexistent channel IDs and SRS callback 429s, plus the story's recorded 90s `nowPlaying` timeout. Do not mark done until the real `track-event → nowPlaying` and HLS segment growth proof passes.
2. If the machine-proof story closes, advance/review `creator-channel-engine-e2e-infra` parent.
3. Then design the remaining dependent stories:
   - `e2e-browser-decode-playback-proof` (L3 hard CI gate)
   - `e2e-agent-vision-pixel-inspection` (L4 triage-only)
5. Pause/start a new session around 75–80% context if still active.
