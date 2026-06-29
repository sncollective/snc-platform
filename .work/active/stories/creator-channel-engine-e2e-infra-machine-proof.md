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

- Files changed:
  - `apps/e2e/tests/creator-channel-playback.spec.ts`
  - `apps/e2e/tests/helpers/playback-probes.ts`
- Tests added:
  - `creator-channel-playback.spec.ts` adds the L1-L2 playback proof: test-control seeds Maya's creator-owned `Studio Tour 2026` pool item, the creator-scoped queue route queues it through the real orchestrator, queue status is polled for `nowPlaying.contentId`, and the channel HLS manifest is polled for new media segments.
- Discrepancies from design:
  - The spec queues through the creator-scoped route the Programming UI uses instead of clicking the queue picker. This keeps the queue action on a real product route/orchestrator path while avoiding unrelated UI picker hydration drift; assertions remain machine-pipeline probes.
- Adjacent issues parked: none.

## Verification

- `bun run --filter @snc/e2e test -- --list tests/creator-channel-playback.spec.ts` — pass (spec discovery succeeds).
- `bun run --filter @snc/e2e typecheck` — blocked by unrelated concurrent edit in `apps/e2e/tests/creator-programming.spec.ts` (`testSeededSuffix(testInfo, "studio-tour", 6)` passes a number where the current helper accepts string parts).
- `bun run --filter @snc/e2e test -- tests/creator-channel-playback.spec.ts --project=chromium` — local staging profile blocked before playback proof: `/api/test-control/.../seed` returned 404 because the already-running local API was not started with `TEST_CONTROL_PROFILE=e2e`.
- `CI=1 bun run --filter @snc/e2e test -- tests/creator-channel-playback.spec.ts --project=chromium --workers=1 --retries=0` — starts the e2e API with `TEST_CONTROL_PROFILE=e2e`, queues the content successfully, then fails the real machine proof: queue-status `nowPlaying.contentId` remains `null` for 90s. This indicates the current running media stack did not deliver the creator-channel Liquidsoap `track-event` path for Maya's queued item (likely stale/non-e2e Liquidsoap topology or equivalent media-stack runtime gap). Story intentionally remains `stage: implementing`; not advanced to review.
- Follow-up retry with a speculative e2e-profile Liquidsoap restart on API startup did not prove the fix: the run failed earlier in global auth setup with 502/500 while API logs showed Liquidsoap repeatedly calling stale `/pool/next` channel IDs and SRS callbacks hitting rate limits. The speculative code change was reverted; next pass should diagnose stale Liquidsoap topology / pool-next error handling and SRS callback limiter behavior before retrying the playback proof.
