---
id: e2e-browser-decode-playback-proof
kind: story
stage: done
tags: [testing, streaming, playout, developer-experience]
parent: machine-verifiable-testing
depends_on: [creator-channel-engine-e2e-infra]
release_binding: null
gate_origin: null
created: 2026-06-25
updated: 2026-06-28
---

> **L3 — the hard CI gate for playback.** Vidstack `<video>` `readyState`/`currentTime` advance
> is the deterministic, no-vision-model assertion that blocks CI. The L4 vision capability
> (`e2e-agent-vision-pixel-inspection`) is triage-only and never gates. Child of the
> `machine-verifiable-testing` epic; depends on the infra story landing first.

# E2E playback proof at the browser layer (Vidstack `<video>` decode + progress)

Capability level 3 of the "take the human eyeball out of the AC#5 loop" ladder. Sits **above**
`creator-channel-engine-e2e-infra` (levels 1-2: `track-event → nowPlaying` callback + HLS `.m3u8`
segment growth — machine signals at the pipeline layer) and **below** true agent-vision pixel
inspection (`e2e-agent-vision-pixel-inspection`).

## What this proves that levels 1-2 don't
Levels 1-2 prove the *pipeline produced output* (engine advanced the queue, segments emitted). They
do **not** prove a browser actually decoded and played it. This level drives the real Vidstack player
in Playwright and asserts the `<video>` element reaches a playing state:
- `video.readyState >= HAVE_CURRENT_DATA` (the browser has a decodable frame), and
- `video.currentTime` advances over a short window (playback is progressing, not stalled).

Deterministic, no vision model — a normal Playwright assertion on `page.evaluate(() => video.…)`.

## Hard dependency
Blocked by the same gap as `creator-channel-engine-e2e-infra`: the e2e stack has **no creator-channel
playout engine running and no live publisher** (only S/NC-TV broadcast renders an engine —
`liquidsoap-render.ts:68-79`). This story can only assert browser decode once *something* is actually
streaming to a channel the player can load. So it **depends on `creator-channel-engine-e2e-infra`**
(the engine + publisher infra) landing first — or shares that story's design fork (run a creator
engine in the test stack vs route via S/NC-TV carry).

## Current player surface (grounding for design)
- Live page already loads a player against a channel `hlsUrl` (`channels.ts:74` → `<srsStreamName>.m3u8`).
- `live-streaming.spec.ts` today skips anything needing a live publisher (e.g. theater/chat "only
  renders while a channel is actively streaming. With no publisher on the test stack…").
- Player is Vidstack (`vidstack-media-player.md` position; `.claude/skills/vidstack-v1`).

## Design

### Spec file
- `apps/e2e/tests/creator-channel-browser-playback.spec.ts`

Keep L3 in its own chromium-only spec instead of extending `creator-channel-playback.spec.ts`. The
L1-L2 proof stays focused on pipeline signals (`nowPlaying` + HLS growth); this story adds the
browser-decode gate without coupling its failures to the lower-level diagnosis path.

### Setup
Mirror `creator-channel-playback.spec.ts` exactly for the streaming preconditions:
- `test.use({ storageState: "auth/stakeholder.json" })`
- chromium-only partitioning via `test.skip(testInfo.project.name !== "chromium", ...)`
- `seedMayaProgramming(request, { pool: true, queue: false, channelActive: true, syncPlaybackEngine: true })`
- queue Maya's seeded content through `queueCreatorContent(authenticatedRequest, seed.channelId, seed.contentId)`
- `afterEach` resets Maya via `resetMayaProgramming(request, { channelActive: false, syncPlaybackEngine: true })`

Before touching the browser proof, re-run the L1-L2 preconditions inside this spec so the failure
surface stays honest:
- poll `fetchCreatorQueueStatus(...).nowPlaying?.contentId` until it equals `seed.contentId`
- poll `fetchChannelHlsUrl(request, seed.channelId)` until non-null
- poll `fetchHlsManifestSnapshot(request, hlsUrl).segmentUris.length` until `> 0`

Those probes are not the assertion-under-test here; they are the deterministic gate that confirms the
browser is pointed at a genuinely live creator stream before asking it to decode.

### Player-driving approach
Drive the real `/live` route and let the app's existing auto-play path activate Vidstack:
1. `await page.goto(`/live?channel=${seed.channelId}`)`
2. wait for the native media element rendered by Vidstack to exist
3. read the native element through Playwright evaluation, not Vidstack internal state

Selector strategy:
- first choice: `document.querySelector('[data-media-player] video')`
- fallback: `document.querySelector('video')`

The route already selects the `channel` search param, resolves the channel from `/api/streaming/status`,
and calls `actions.play(...)` with the channel `hlsUrl`. `GlobalPlayer` mounts Vidstack with
`streamType: "live"` and `muted: true`, so Chromium autoplay policy should allow playback without a
synthetic click.

### Deterministic assertion
The hard machine proof is the native `<video>` element only:
- decode proof: `video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA` (numeric `2`)
- progress proof: `video.currentTime` increases over a short bounded window after decode is reached

Implementation shape:
1. poll until the native `<video>` exists
2. poll until `readyState >= 2`
3. capture `baselineCurrentTime`
4. over a bounded follow-up window, poll until `currentTime > baselineCurrentTime`

Recommended assertion form:
- `expect.poll(() => page.evaluate(...readyState...), { timeout: 30_000, intervals: [250, 500, 1_000] }).toBeGreaterThanOrEqual(2)`
- `expect.poll(() => page.evaluate(...currentTime...), { timeout: 15_000, intervals: [500, 1_000, 2_000] }).toBeGreaterThan(baselineCurrentTime)`

If needed for diagnosability, the evaluated object may also return `paused`, `ended`, and `error?.code`
for the failure message, but the pass/fail gate remains `readyState >= 2` plus `currentTime` advance.
Do not replace this with Vidstack store state, CSS state, "LIVE" badges, or network-only probes.

### Polling strategy
Reuse the same upstream bounded polling envelope as the L1-L2 proof for the stream setup:
- setup polls: 90_000 ms timeout, intervals `[1_000, 2_000, 5_000]`
- browser decode poll: 30_000 ms timeout after `page.goto(...)`
- browser progress poll: 15_000 ms timeout after baseline capture

This splits failures cleanly:
- stream never became real: L1-L2 precondition poll fails
- player never attached a native element: `<video>` existence poll fails
- browser loaded metadata but not decodable frames: `readyState` poll fails
- decode happened but playback stalled: `currentTime` advancement poll fails

### Design decisions
- Single story, no child split. The implementation surface is one focused Playwright spec plus, at most,
  a tiny helper for reading native video state. Splitting would add coordination overhead without
  reducing risk.
- Keep the assertion at the native element boundary. Vidstack wraps the media element, but the CI gate
  must prove browser decode rather than player-intent state.
- Re-prove L1-L2 setup inside the L3 spec instead of assuming it from another test file. That keeps
  this story self-contained and prevents false negatives caused by hitting `/live` before the creator
  channel is actually streaming.

### Acceptance criteria
- [ ] A chromium-only Playwright spec at `apps/e2e/tests/creator-channel-browser-playback.spec.ts`
      mirrors the Maya seed/queue/reset setup from `creator-channel-playback.spec.ts`.
- [ ] The spec proves Maya's creator channel is genuinely streaming before browser assertions by
      observing `nowPlaying`, resolving `hlsUrl`, and confirming HLS segment publication.
- [ ] The spec loads `/live?channel=<maya-channel-id>` and queries the native Vidstack `<video>`
      element via `page.evaluate(...)`.
- [ ] The spec passes only when `video.readyState >= 2` and `video.currentTime` advances over a
      bounded window.
- [ ] The spec does not assert on Vidstack internal state, mocked status, or vision-model output.

### Risks
- Browser decode can lag slightly behind manifest publication, so the decode and progress polls must
  remain bounded but non-trivial; shortening them below the proposed windows would risk flake.
- If `/live` ever renders multiple video elements, the selector should stay anchored to
  `[data-media-player] video` before falling back to bare `video`.

## Implementation notes

- Files changed:
  - `apps/e2e/tests/creator-channel-browser-playback.spec.ts` — the L3 chromium-only
    spec. Mirrors the L1-L2 setup (seed + activate + sync, queue via the creator
    route, reset in afterEach), re-proves the stream preconditions (nowPlaying,
    hlsUrl, HLS segment publication) inside this spec so it is self-contained,
    then drives `/live?channel=<maya-channel-id>` and reads the native Vidstack
    `<video>` element via `page.evaluate`.
- Tests added:
  - `creator-channel-browser-playback.spec.ts` — the hard CI gate: poll until the
    native `<video>` exists, poll until `readyState >= 2` (HAVE_CURRENT_DATA),
    capture `baselineCurrentTime`, poll until `currentTime > baselineCurrentTime`
    over a bounded window. The evaluated state also carries `paused`/`ended`/
    `error.code` for failure diagnosability, but the pass/fail gate is the native
    element's `readyState` + `currentTime` advance only — no Vidstack internal
    state, no mocked status, no vision-model output.
- Discrepancies from design: none.
- Adjacent issues parked: none.

## Verification

- `bun run --filter @snc/e2e typecheck` — pass.
- `npx playwright test tests/creator-channel-browser-playback.spec.ts --list` —
  pass (spec discovery succeeds).
- `npx playwright test tests/creator-channel-browser-playback.spec.ts
  --project=chromium --workers=1 --retries=0` against the PM2 staging stack
  (localhost:3082, `AUTH_RATE_LIMIT_PROFILE=e2e` + `TEST_CONTROL_PROFILE=e2e`) —
  PASS (2/2, 18.3s): the native `<video>` reaches `readyState >= 2` and
  `currentTime` advances over the bounded window. The browser actually decoded
  and played Maya's creator-channel content — the L3 hard CI gate is
  machine-proven without a human watching pixels.

## Review

- Verdict: Approve - story verified by implement; fast-lane advance.
- Lane: fast (story with green implementation verification).
- Verification confirmed green: e2e browser-decode spec passes (2/2, 18.3s),
  e2e typecheck passes.
- The hard CI gate is the native `<video>` element's `readyState` + `currentTime`
  advance only — deterministic, no vision model, no tautology.
