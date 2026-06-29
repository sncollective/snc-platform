---
id: creator-channel-engine-e2e-infra
kind: feature
stage: done
tags: [testing, streaming, playout, developer-experience]
parent: machine-verifiable-testing
depends_on: []
release_binding: 0.4.0
gate_origin: null
created: 2026-06-25
updated: 2026-06-28
---

# E2E test-stack infra: assert real creator-channel playback (track-event → nowPlaying)

**Priority: P0** — the canonical rung-4-to-rung-3 lift of the `machine-verifiable-testing` epic.
It retires the manual AC#5 playback eyeball ("open `/live` and watch") by landing the L1–L2
machine proof for creator-channel queued content.

This item was originally scoped as a story, but design discovery showed it is feature-sized: it
requires an engine topology/test-profile change, startup/prefetch support, and an e2e machine-proof
spec. It has therefore been promoted in place to a feature with child stories; downstream items still
depend on the same id.

## Why

The creator programming e2e specs prove that Maya can assign + queue her own content. They do not
prove that it **actually plays**, because the e2e stack currently renders only playout/broadcast
channels into Liquidsoap and has no creator-channel playout engine. The machine proof we need is:

1. Liquidsoap starts the creator queue item and posts `track-event`.
2. The API promotes the queued item to `nowPlaying` through the real orchestrator.
3. SRS serves a creator-channel HLS manifest whose segment list grows while playback is active.

## Design discovery summary

Read-only mapping confirmed the key gap:

- `apps/api/src/services/liquidsoap-config.ts` `generateLiquidsoapConfig()` queries active channels
  where `role in ["playout", "broadcast"]`; creator channels are `role="live-ingest"`, so they are
  not rendered into `playout.liq`.
- `apps/api/src/services/playout-orchestrator.ts` `initialize()` likewise initializes only active
  `role === "playout"` channels, so creator queues are not prefetched/pushed on API startup.
- `apps/api/src/services/liquidsoap-render.ts` can already render non-broadcast queue sources; the
  deferred part is per-channel **live** input. Queue-only creator playback does not need a per-channel
  live tier.
- `apps/api/src/routes/playout-channels.routes.ts` already exposes the shared-secret
  `track-event` callback, and `creator-playout.routes.ts` already exposes creator-scoped queue
  status with `nowPlaying`.
- `apps/api/src/routes/streaming.routes.ts` `/api/streaming/status` exposes active channels with
  `hlsUrl`, `nowPlaying`, and `liveState`; `apps/api/src/services/channels.ts` derives HLS URLs from
  `SRS_HLS_URL` + `srsStreamName`.
- `scripts/dev/test-live-fallback.sh` proves an ffmpeg publisher path for the **broadcast live
  input**, but that path proves S/NC TV takeover, not creator-channel queued-content playback.

## Design decisions

- **Primary fork:** run creator-channel queue playback in the e2e/test profile (Fork A), not a
  broadcast-only S/NC TV proxy proof. Broadcast proxy would prove HLS plumbing but would not fully
  retire the creator-channel AC#5 gap.
- **Queue-only first:** include selected creator `live-ingest` channels in Liquidsoap topology for
  queued content only. Do **not** implement per-channel live RTMP ingest in this feature; that is a
  separate media-ingest design. The renderer already skips non-broadcast live tiers to avoid port
  collision, and this feature should preserve that behavior.
- **Explicit test profile:** creator-channel rendering/prefetch for e2e is gated by an explicit test
  profile or config switch. Do not silently render every inactive creator channel in normal runtime.
- **Machine probes allowed:** the e2e proof may poll creator queue status and HLS manifests as machine
  probes under `.work/CONVENTIONS.md`; browser-facing assertions remain in the browser for UI claims.
- **Fallback:** if queue-only creator rendering proves unexpectedly invasive during implementation,
  file a blocker and optionally scope a narrower broadcast pipeline proof as separate work; do not
  claim the creator-channel proof is complete from a broadcast-only result.

## Implementation units

### Unit 1: Engine topology/test-profile inclusion

**Story:** `creator-channel-engine-e2e-infra-topology`

**Files:**
- `apps/api/src/services/liquidsoap-config.ts`
- `apps/api/src/services/liquidsoap-render.ts` only if a renderer guard needs tightening
- `apps/api/src/config.ts` if the explicit e2e/test-profile switch is not already available from the
  harness work
- tests near existing Liquidsoap config/render tests

**Intent:** In an explicit e2e/test profile, include selected active creator `live-ingest` channels in
Liquidsoap config generation as queue-capable output channels. Preserve normal runtime behavior and
preserve non-broadcast live-tier deferral.

**Acceptance:**
- [ ] Default config generation still excludes creator `live-ingest` channels.
- [ ] E2E/test profile can include Maya's creator channel (or a deterministic test creator channel)
      in rendered topology.
- [ ] Rendered creator block has queue/pool/HLS output plumbing but no per-channel live RTMP listener.

### Unit 2: Startup/prefetch support for creator test channels

**Story:** `creator-channel-engine-e2e-infra-prefetch`
**Depends on:** `creator-channel-engine-e2e-infra-topology`

**Files:**
- `apps/api/src/services/playout-orchestrator.ts`
- `apps/api/src/jobs/register-workers.ts` if startup wiring needs profile-aware initialization
- focused API/service tests for initialize/prefetch behavior

**Intent:** Ensure e2e-selected creator channels get the same queue initialization/prefetch treatment
that playout channels get, so a queued creator content item can be pushed to Liquidsoap and trigger a
real `track-event`.

**Acceptance:**
- [ ] Default startup still initializes ordinary playout channels only.
- [ ] E2E/test profile initializes selected creator channels enough for queued content playback.
- [ ] Existing creator route queue operations still go through the shared orchestrator and do not gain
      cross-tenant scope.

### Unit 3: Machine-proof e2e spec

**Story:** `creator-channel-engine-e2e-infra-machine-proof`
**Depends on:** `creator-channel-engine-e2e-infra-topology`, `creator-channel-engine-e2e-infra-prefetch`

**Files:**
- `apps/e2e/tests/creator-channel-playback.spec.ts` or an equivalent focused e2e spec
- `apps/e2e/tests/helpers/*` for polling queue status and HLS manifests
- `apps/e2e/playwright.config.ts` only for required test-profile env wiring not already handled

**Intent:** Drive a real creator-channel queued-content playback proof in the e2e stack: seed/queue
Maya's `Studio Tour 2026`, poll queue status until that content is `nowPlaying`, and poll the
channel's HLS manifest until segment count grows.

**Acceptance:**
- [ ] The spec queues a creator-owned content item through the product surface or an allowed setup path.
- [ ] The spec observes `nowPlaying.contentId`/title through creator queue status or streaming status
      after the real Liquidsoap `track-event` path fires.
- [ ] The spec obtains the channel `hlsUrl` and confirms the `.m3u8` segment list grows over a bounded
      polling window.
- [ ] The spec runs without a human watching pixels.

## Implementation order

1. `creator-channel-engine-e2e-infra-topology`
2. `creator-channel-engine-e2e-infra-prefetch`
3. `creator-channel-engine-e2e-infra-machine-proof`

## Risks

- Rendering creator channels too broadly could create unnecessary Liquidsoap outputs or expose inactive
  creator streams. Keep inclusion explicit and test-profile scoped.
- Per-channel live ingest is intentionally out of scope; accidentally adding `input.rtmp` listeners for
  creator channels can collide with the broadcast listener and fail the engine.
- Queue/pool prefetch must preserve creator ownership boundaries. The creator content scope is derived
  from channel ownership, not request input.
- HLS segment growth can be timing-sensitive. Use bounded polling and retain artifacts on failure rather
  than a brittle fixed sleep.

## Implementation summary

All three child stories reached `done`:

- `creator-channel-engine-e2e-infra-topology` — default Liquidsoap config still
  excludes creator `live-ingest` channels; the explicit e2e profile (now keyed
  on `TEST_CONTROL_PROFILE`) includes selected creator channels as queue-capable
  outputs without rendering a per-channel live RTMP listener.
- `creator-channel-engine-e2e-infra-prefetch` — e2e-profile startup/prefetch
  for selected creator channels through the shared orchestrator; default startup
  still initializes ordinary playout channels only.
- `creator-channel-engine-e2e-infra-machine-proof` — the L1-L2 playback proof
  passes: the real media-stack signal (track-event → nowPlaying → HLS segment
  growth) is observed end-to-end without a human watching pixels. This is the
  canonical rung-4-to-rung-3 lift of the epic.

Three compounding root causes were diagnosed and fixed during the machine-proof
story (see that story's body for the full diagnosis): stale Liquidsoap topology
(wrong profile key), seed-demo content videos lacking an audio track (decode
failure → no track-event), and a harbor-readiness race after restart. A parked
backlog item (`idea-seed-demo-content-videos-lack-audio.md`) is the audit trail
for the inline seed-demo fix.

## Test integrity contract

If this work exposes a real product bug, park it rather than silently bundling a fix. Fix bad fixtures,
stale assertions, and brittle waits in-session. Never replace the playback proof with a tautology.

## Review

- Verdict: Approve.
- Lane: deep (feature with fresh-context evaluation). Reviewer: openai-codex/gpt-5.4
  (different model class than the implementing host).
- Scope: single cross-model fresh-context pass over the feature + child stories +
  commits `a181575`, `6720593`, `95755bb`.
- No findings above nit level. The reviewer confirmed the proof path is real —
  no tautology, no mocked-status shortcut; the profile split, harbor-readiness
  sync, prod-safe SRS callback limiter, and master→media playlist resolution all
  line up with the feature's intent. No foundation-doc drift.
