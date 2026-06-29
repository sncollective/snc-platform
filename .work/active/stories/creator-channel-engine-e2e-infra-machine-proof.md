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
