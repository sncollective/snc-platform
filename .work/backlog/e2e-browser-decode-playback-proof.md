---
id: e2e-browser-decode-playback-proof
created: 2026-06-25
updated: 2026-06-25
tags: [testing, streaming, playout, developer-experience]
---

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

## Notes
Needs design alongside or after `creator-channel-engine-e2e-infra`. Smallest delta on top of that
story's infra: once a creator channel is genuinely streaming in the test stack, add a Playwright case
that loads the player and asserts `readyState`/`currentTime`. Pairs naturally with the AC#5 close-out.
