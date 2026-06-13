---
id: refactor-playout-stream-names-dedup
kind: story
stage: review
tags: [refactor, quality, streaming]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-04-20
updated: 2026-06-13
parent: null
---

Eliminate duplicate playout/broadcast stream-name definitions by extracting them to a single canonical location.

## Re-grounding discovery (2026-06-13)

The original scope was stale: `PLAYOUT_STREAM_NAMES` no longer exists anywhere. The duplication between `streaming.routes.ts` and `seed-channels.ts` was eliminated by the 0.2.1 playout rework — `streaming.routes.ts` now classifies playout streams via DB lookup (`isPlayoutStream` querying `channels.srsStreamName`), which is strictly better than a constant.

The **surviving** duplication was the broadcast stream name `"snc-tv"`, hardcoded independently in:

- `apps/api/src/scripts/seed-channels.ts` — `BROADCAST_CHANNEL.srsStreamName`
- `apps/api/src/services/liquidsoap-config.ts` — the `CHANNEL_SNCTV_STREAM` env default in the generated `.liq` template

Drift risk: changing the seed without setting the env var would have Liquidsoap publish to a stream name the DB no longer knows. `"channel-classics"` appears only in the seed (no duplication); web/test occurrences are display text and fixtures, out of scope.

## Implementation

- Extracted `SNC_TV_BROADCAST` (`name` + `srsStreamName`) to `apps/api/src/services/channels.ts` — API-internal placement per the original scoping note (no web consumer of the stream name; the web reads HLS URLs from API responses). The downstream channel-topology model-render feature inherits this as the stream-name constant owner.
- `seed-channels.ts` imports it as `BROADCAST_CHANNEL`.
- `liquidsoap-config.ts` interpolates `escLiq(SNC_TV_BROADCAST.srsStreamName)` into the template's env default. Rendered `.liq` is byte-identical: the value contains no escapable characters, so it renders exactly the prior literal.

## Tasks

- [x] Determine whether the constant is API-internal or genuinely shared → API-internal; placed in `apps/api/src/services/channels.ts`.
- [x] Extract the constant to the chosen location.
- [x] Update both consumers (`seed-channels.ts`, `liquidsoap-config.ts`) to import from it. (`streaming.routes.ts` no longer participates — DB lookup.)
- [x] Verify: `@snc/api` typecheck green; API unit suite 98 files / 1501 tests green (includes `liquidsoap-config` output tests). Pre-existing, unrelated `@snc/web` typecheck failures (mock typings in `simulcast-destination-manager.test.tsx`) confirmed present on clean tree via stash.

## Review

Agent review pass (fresh-context sub-agent, 2026-06-13): **APPROVE.** Verified `.liq` byte-identity (`escLiq("snc-tv")` is the identity transform inside the same template literal), one-way import direction (no cycle), `exactOptionalPropertyTypes` soundness of the readonly-literal spread into `ensureBroadcast`, JSDoc/named-export convention fit, and that the only remaining `"snc-tv"` in production code is the canonical definition (`"snc-tv-queue"` at liquidsoap-config.ts is a distinct queue id, not the stream name).

Awaiting user review-pass + release pick (`release_binding` set at user approval per `.work/CONVENTIONS.md` §Release-binding lifecycle).
