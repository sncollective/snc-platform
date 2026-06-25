---
id: creator-channel-engine-e2e-infra
kind: story
stage: drafting
tags: [testing, streaming, playout, developer-experience]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-25
updated: 2026-06-25
---

# E2E test-stack infra: assert real creator-channel playback (track-event → nowPlaying)

Standalone test-infrastructure story, linked from `creator-programming-e2e`. Scoped separately
because the creator-channel-playout-engine-in-test-stack capability is reusable by any future
streaming e2e, and it's meaningfully heavier than the UI specs — keeping it out of the UI feature
lets that coverage ship without waiting on this.

## Why
This is the piece that retires the **manual AC#5 playback eyeball** entirely. The UI specs
(`creator-programming-e2e`) prove a creator can assign + queue their own content; they cannot prove
it ACTUALLY PLAYS, because the e2e stack has no live media publisher and only the S/NC-TV broadcast
channel runs a playout engine today (`liquidsoap-render.ts:68-79`).

There IS a machine signal for real playback: when Liquidsoap starts a queue item it POSTs a
`track-event` (`apps/api/src/routes/playout-channels.routes.ts:122` → `orchestrator.onTrackStarted`)
and the item becomes `nowPlaying` in `/status`. Asserting it needs a creator-channel engine actually
running and pulling from the queue.

## Scope (to be designed — this is a drafting story, not yet decomposed)
Stand up / arm a creator-channel playout engine in the e2e test stack, OR route the assertion via
the S/NC-TV broadcast channel that carries the creator. Then:
1. Seed/queue a creator content item (or reuse the `creator-programming-e2e` golden setup).
2. Drive playout (the engine pulls the queue item; `scripts/dev/test-live-fallback.sh` shows the
   ffmpeg-publish pattern for the broadcast live input).
3. Assert the `track-event → nowPlaying` callback: poll `/status` until the queued CONTENT item is
   `nowPlaying` (machine proof the URI resolved + media started).
4. Assert HLS output: poll the channel's `hlsUrl` `.m3u8` and confirm the segment list grows.

## Acceptance (provisional — refine at design)
- [ ] A creator content item queued in the test stack becomes `nowPlaying` via the real
      track-event callback (not a mocked status).
- [ ] The channel's HLS manifest emits growing segments while the item plays.
- [ ] Runs in CI without a human watching pixels — the last manual rung of AC#5 is gone.

## Notes
Needs design (`/agile-workflow:e2e-test-design` or `feature-design`) before implementation — the
"run a creator-channel engine in the test stack vs route via S/NC-TV carry" choice is a real fork
with infra implications. May itself decompose into a feature. Until this lands, AC#5's playback rung
remains a one-time manual user check.

## Capability ladder ("take the human eyeball out of the loop")
This story is **levels 1-2** (machine signals: `track-event → nowPlaying` + HLS segment growth). The
user wants the eyeball fully removed; two follow-on backlog items build on this story's infra:
- **Level 3** — `e2e-browser-decode-playback-proof`: drive the real Vidstack player, assert
  `<video>` `readyState`/`currentTime` advance (browser actually decoded + played). Deterministic.
- **Level 4** — `e2e-agent-vision-pixel-inspection`: screenshot the playing frame, a vision agent
  inspects the pixels (the literal "agent eyeballs"; also a general visual-debugging capability).
Both depend on this story's engine + publisher infra. Design the ladder together next session — the
engine/publisher fork here determines what levels 3-4 can assert.
