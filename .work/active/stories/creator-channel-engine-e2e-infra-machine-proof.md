---
id: creator-channel-engine-e2e-infra-machine-proof
kind: story
stage: implementing
tags: [testing, streaming, playout, developer-experience]
parent: creator-channel-engine-e2e-infra
depends_on: [creator-channel-engine-e2e-infra-topology, creator-channel-engine-e2e-infra-prefetch]
release_binding: null
gate_origin: null
created: 2026-06-28
updated: 2026-06-28
---

# Creator-channel playback e2e: machine proof spec

## Scope

Add the focused e2e spec that retires the manual playback eyeball at L1–L2: queue creator content,
observe `track-event → nowPlaying`, and prove the channel HLS manifest grows segments.

## Implementation targets

- `apps/e2e/tests/creator-channel-playback.spec.ts` or equivalent focused spec
- `apps/e2e/tests/helpers/*` for queue-status and HLS-manifest polling
- `apps/e2e/playwright.config.ts` only for required test-profile env wiring not already handled

## Acceptance criteria

- [ ] The spec queues a creator-owned content item through the product surface or an allowed setup path.
- [ ] The spec observes `nowPlaying.contentId` or title through creator queue status or streaming status
      after the real Liquidsoap `track-event` path fires.
- [ ] The spec obtains the channel `hlsUrl` and confirms the `.m3u8` segment list grows over a bounded
      polling window.
- [ ] The spec runs without a human watching pixels.

## Test integrity contract

Park real product bugs; fix brittle waits and bad fixtures; never replace the playback proof with a
mocked status or tautological assertion.

## Implementation notes

- Files changed (this pass):
  - `apps/e2e/tests/creator-channel-playback.spec.ts` — seed now activates Maya's
    channel + syncs the playback engine (`channelActive: true`,
    `syncPlaybackEngine: true`); afterEach reset deactivates + re-syncs.
  - `apps/e2e/tests/helpers/playback-probes.ts` — (unchanged this pass)
  - `apps/e2e/tests/helpers/test-control.ts` — `MayaProgrammingSeedOptions` and
    `MayaProgrammingState` carry `channelActive` / `syncPlaybackEngine`.
  - `apps/api/src/services/test-control.ts` — `seedMayaCreatorProgramming` /
    `resetMayaCreatorProgramming` accept `channelActive` (toggle the Maya
    `channels.is_active` row) and `syncPlaybackEngine` (regenerate the
    `playout.liq` from DB state, signal Liquidsoap restart, wait for health +
    harbor handler readiness, then `orchestrator.initialize()` to prefetch).
    `syncPlaybackEngine` polls Maya's harbor now-playing endpoint until a
    handler is registered before initializing, fixing the race where
    `/health` responds before per-channel harbor handlers are re-registered
    after restart (the prefetch push would 404 and leave content unpushed).
  - `apps/api/src/routes/test-control.routes.ts` — seed schema accepts the two
    new options.
  - `apps/api/src/services/liquidsoap-config.ts` and
    `apps/api/src/services/playout-orchestrator.ts` — the creator live-ingest
    inclusion switch now keys on `TEST_CONTROL_PROFILE === "e2e"` (the e2e
    test-control surface) rather than `AUTH_RATE_LIMIT_PROFILE`. The auth
    limiter and the test-control surface are separate concerns; coupling
    creator-channel rendering to the auth profile was an incidental overload.
  - `apps/api/src/middleware/rate-limit.ts` + `apps/api/src/app.ts` — the SRS
    callback limiter now uses a profile-aware cap (`getSrsCallbackRateLimitMax`)
    that relaxes to 1000/min under `TEST_CONTROL_PROFILE=e2e` while production
    stays at 30/min. The previous fixed 30/min cap caused 429s on the SRS
    `on_publish`/`on_forward` callbacks during e2e when Liquidsoap + SRS were
    both publishing + polling.
  - `apps/api/src/scripts/seed-demo.ts` — `generateVideo()` now emits an AAC
    sine-tone audio track alongside the video, so generated creator content
    mp4s decode under Liquidsoap (which requests `{audio=pcm(stereo),video=canvas}`).
    The prior video-only mp4s failed decode, the request was destroyed,
    `on_metadata` never fired, and no `track-event` reached the API — the root
    cause of `nowPlaying` staying null.
- Tests added/updated:
  - `creator-channel-playback.spec.ts` — the L1-L2 playback proof: test-control
    seeds + activates Maya's channel + syncs the engine, the creator-scoped
    queue route queues content through the real orchestrator, queue status is
    polled for `nowPlaying.contentId`, and the channel HLS manifest is polled
    for new media segments.
  - `apps/api/tests/middleware/rate-limit.test.ts` — added
    `getSrsCallbackRateLimitMax` profile tests.
  - `apps/api/tests/services/liquidsoap-config.test.ts` and
    `apps/api/tests/services/playout-orchestrator.test.ts` — updated the e2e
    creator-channel inclusion assertions to key on `TEST_CONTROL_PROFILE`.
  - `apps/api/tests/integration/test-control-service.test.ts` — added a test
    that the `channelActive` toggle activates/deactivates Maya's channel row.
- Discrepancies from design:
  - The spec queues through the creator-scoped route the Programming UI uses
    instead of clicking the queue picker. This keeps the queue action on a real
    product route/orchestrator path while avoiding unrelated UI picker
    hydration drift; assertions remain machine-pipeline probes.
- Adjacent issues parked:
  - `.work/backlog/idea-seed-demo-content-videos-lack-audio.md` — the
    seed-demo video-only generation bug. Fixed inline (load-bearing for the
    proof) and parked as the audit trail per the test-integrity rule.

## Verification

- `bun run --filter @snc/e2e test -- --list tests/creator-channel-playback.spec.ts` —
  pass (spec discovery succeeds).
- `bun run --filter @snc/e2e typecheck` — pass.
- `bun run --filter @snc/api test:unit` — 1883 tests pass (incl. the new
  `getSrsCallbackRateLimitMax` + test-control + topology/orchestrator updates).
- `bun run --filter @snc/api test:integration -- tests/integration/test-control-service.test.ts` —
  pass (4 tests, incl. the new `channelActive` toggle test).
- `npx playwright test tests/creator-channel-playback.spec.ts --project=chromium
  --workers=1 --retries=0` against the PM2 staging stack (localhost:3082) with
  `AUTH_RATE_LIMIT_PROFILE=e2e` + `TEST_CONTROL_PROFILE=e2e` — PASS: the spec
  seeds + activates Maya's channel, syncs the playback engine, queues
  `Studio Tour 2026` through the creator route, observes
  `nowPlaying.contentId === <studio-tour-id>` after the real Liquidsoap
  `track-event` path fires, resolves the channel `hlsUrl`, and confirms the
  `.m3u8` segment list grows over the bounded polling window. The real
  media-stack signal (track-event → nowPlaying → HLS segment growth) is
  observed end-to-end without a human watching pixels.

### Root-cause diagnosis (this pass)

Three compounding issues kept `nowPlaying.contentId` null for 90s:

1. **Stale Liquidsoap topology.** Maya's creator `live-ingest` channel was
   not rendered into `playout.liq` at runtime, so its harbor
   `/channels/<maya-id>/queue` handler was absent and `pushTrack` 404'd. The
   e2e profile inclusion switch was keyed on `AUTH_RATE_LIMIT_PROFILE`, which
   is the wrong concern. Re-keyed on `TEST_CONTROL_PROFILE`, and the
   test-control seed now activates the channel + regenerates+restarts the
   engine so the running config includes Maya.
2. **Content media had no audio track.** `seed-demo.ts` `generateVideo()` emitted
   video-only mp4s; Liquidsoap's encoder requests
   `{audio=pcm(stereo),video=canvas}` and failed decode (`Detected content:
   {video=canvas}`), so the request was destroyed and `on_metadata` never fired.
   Fixed `generateVideo()` to add a sine-tone AAC audio track (mirroring
   `seed-playout-content.sh`); regenerated the three affected content objects in
   Garage.
3. **Harbor-readiness race.** `waitForHealth` returns true as soon as
   `/health` responds, but per-channel harbor handlers are registered slightly
   later after restart — `orchestrator.initialize()`'s prefetch push would then
   404 and leave content unpushed. `syncPlaybackEngine` now polls Maya's harbor
   now-playing endpoint until a handler is registered before initializing.

The SRS callback 429s were a symptom of the fixed 30/min limiter under e2e load,
not a root cause; the profile-aware cap removes the noise.
