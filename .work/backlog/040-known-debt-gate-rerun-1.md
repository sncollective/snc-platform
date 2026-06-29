---
id: 040-known-debt-gate-rerun-1
kind: story
stage: backlog
tags: [debt]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: null
created: 2026-06-29
updated: 2026-06-29
---

# 0.4.0 known debt — gate rerun 1 medium/low findings (accepted, ship-blocking-excluded)

Per the release bar agreed for 0.4.0: criticals/highs loop-to-clean (drained separately);
mediums/lows are accepted debt and ship. This item tracks them so they don't evaporate.
All surfaced in gate rerun 1 (2026-06-29) over the expanded 221-code-file bundle.

## Security (1 med, 2 low) — refinements to the security fixes
- SSRF guard permits non-canonical/internal-resolving hosts (`127.1`, DNS-to-private) — `packages/shared/src/simulcast.ts:19,52,72-86`. Canonicalize all numeric IP forms + resolve DNS at validation time.
- Liquidsoap track-event JSON built by raw string interpolation (metadata with quotes/backslashes → malformed JSON) — `apps/api/src/services/liquidsoap-render.ts:290-304`. Use a JSON encoder or send opaque IDs.
- Built-in simulcast domain pinning bypassable on partial PATCH (platform omitted → allowlist skipped) — `packages/shared/src/simulcast.ts:141,168-176`. Validate against merged current row.

## Cruft (1 med, 3 low) — post-extraction debris in new `playout/*` modules
- Redundant auto-fill threshold helper causes duplicate queue-depth reads — `playout/queue-control.ts:68,212` + `playout/auto-fill.ts:118`. Call autoFill() directly.
- Orphaned `toChannelContent` projection after playout extraction — `playout/queue-projections.ts:69`. Delete.
- "Unit 1" work-item note leaked into production UI comment — `editorial-surface.tsx:285`. Drop.
- Extracted playout leaf modules export internal logger types with no external consumers — `playout/{content-pool,auto-fill,prefetch,startup,queue-control}.ts`. Remove `export`.

## Refactor (3 med)
- SRS notification fire-and-forget lacks non-failing boundary — `streaming-callbacks.ts:173`. Wrap in `.catch()`.
- Auto-fill queue-depth query duplicated — `playout/auto-fill.ts:27,122`. Extract `getActiveQueueDepth`.
- Admin/creator playout API clients duplicate operations — `apps/web/src/lib/playout-channels.ts:12` + `creator-playout-channels.ts:19`. Extract `createPlayoutChannelApi(basePath)` factory.

## Docs (4 med, 2 low)
- Streaming docs misstate simulcast behavior (creator vs platform; config-reload vs publisher-kick) — `docs/streaming.md:64-66`.
- Auth docs overstate unverified-account capability after join security fix — `docs/auth.md:148-150`.
- README env table omits AUTH_RATE_LIMIT_PROFILE / TEST_CONTROL_PROFILE / TEST_CONTROL_SECRET / PLAYOUT_CALLBACK_SECRET — `README.md:235,265-269`.
- e2e test-control pattern skill omits required secret header — `.claude/skills/platform-patterns/e2e-test-control-state-bracket.md:3,17-20`.
- Liquidsoap skill implies Harbor is safe external control without app-level auth — `.claude/skills/liquidsoap-v2/SKILL.md:176`.
- Release note gate posture internally stale (says "not yet run" + records results) — `.work/active/release-0.4.0.md:149-162`.

## Patterns (4 stale citations) — drift from the impl wave
- `structural-edit-regenerate-restart.md` — setTierEnabled/addCarryEdge examples removed (M7 deleted them). Update to setMode/setManualTier/takeQueue.
- `bounded-expect-poll-probe.md` — creator-channel-playback spec line numbers shifted.
- `use-polling.md` — editorial-surface.tsx line shifted (44→51/59).
- `responsive-table-dual-render.md` — content-pool-table.tsx lines shifted (45→36, 96→87).

## Not in scope (drained separately as blocking)
The 12 critical/high rerun-1 findings (usePolling test, stale-policyVersion test, simulcast-update test, testcontrol-secret test, harbor-secret docs, queue-status concurrent-awaits, autofill/queueprojections JSDoc, join-route SEO) are drained as `gate2-*` items, not part of this debt.
