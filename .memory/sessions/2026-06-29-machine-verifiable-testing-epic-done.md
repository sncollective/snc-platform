# 2026-06-29 — Machine-verifiable testing epic completed

## Outcome

The `machine-verifiable-testing` epic reached `stage: done`. All five children
are done; the verification ladder is fully machine-verifiable-by-default.

## What landed this session

Picked up from the prior bank point where `creator-channel-engine-e2e-infra-machine-proof`
was stuck: the e2e spec could queue Maya content but `nowPlaying.contentId`
stayed null for 90s. Diagnosed and fixed three compounding root causes:

1. **Stale Liquidsoap topology** — creator live-ingest channel inclusion was
   keyed on `AUTH_RATE_LIMIT_PROFILE` (wrong concern). Re-keyed on
   `TEST_CONTROL_PROFILE`. The test-control seed now activates the channel
   (`channelActive`) and syncs the engine (`syncPlaybackEngine`: regenerate +
   restart + wait-for-health + wait-for-harbor + orchestrator.initialize).
2. **Seed-demo content videos had no audio track** — Liquidsoap's encoder
   requests `{audio=pcm(stereo),video=canvas}`; video-only mp4s failed decode,
   `on_metadata` never fired, no track-event. Fixed `generateVideo()` to emit
   an AAC sine-tone audio track; regenerated the three affected Garage objects.
   Parked as `idea-seed-demo-content-videos-lack-audio.md` (audit trail).
3. **Harbor-readiness race** — `waitForHealth` responds before per-channel
   harbor handlers are re-registered after restart; the prefetch push would
   404 and leave content unpushed. `syncPlaybackEngine` now polls Maya's harbor
   now-playing endpoint before initializing.

Also: profile-aware SRS callback limiter (30/min prod, 1000/min e2e) removes
429 noise; playback probe resolves SRS master→media playlist.

## Then completed the ladder

- **L3** (`e2e-browser-decode-playback-proof`) — the hard CI gate: drives the
  real Vidstack `<video>` element, asserts `readyState >= 2` + `currentTime`
  advance. Passes (2/2, 18.3s).
- **L4** (`e2e-agent-vision-pixel-inspection`) — advisory triage only, never a
  CI gate: reusable `visual-triage.ts` capture helper + triage-report
  `visionCandidates` surfacing + README post-run agent vision runbook.

## Reviews

- `creator-channel-engine-e2e-infra` (feature): deep fresh-context review
  (gpt-5.4) — Approve, no findings above nit.
- `machine-verifiable-testing` (epic): final completion review (gpt-5.5,
  adversarial) — Approve with comments; two nits on the backlog audit-trail
  item addressed.

## Verification

- 1883 unit tests pass; e2e typecheck passes; test-control integration passes.
- The real L1-L2-L3 machine proof passes end-to-end against the PM2 staging
  stack: track-event → nowPlaying → HLS segment growth → browser decode →
  currentTime advance. No human watching pixels.

## Key commits

- `95755bb` implement: creator-channel-engine-e2e-infra-machine-proof
- `1e9b904` review: creator-channel-engine-e2e-infra (approve)
- `d42f431` implement: e2e-browser-decode-playback-proof
- `5a2d7a2` implement: e2e-agent-vision-pixel-inspection
- `0d2da4f` review: machine-verifiable-testing (approve, epic done)

## Environment notes

- Dev services via `bash scripts/dev/start-dev.sh`; migrations applied.
- Postgres exited once (stale checkpoint) and was restarted by start-dev.
- SRS needed a restart once to clear stale `StreamBusy` publish state (a
  pre-existing Liquidsoap↔SRS reconnect-storm artifact, not introduced here).
- Unrelated untracked files left untouched: `.pi/`, `publicity-advisor-brief.pdf`,
  `scripts/dev/sandbox-test-e2e.sh`.
