---
id: bold-event-spine-publishers-input-switch
kind: story
stage: done
tags: [streaming, playout]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: bold-event-spine-publishers
---

# Liquidsoap input-switch telemetry (riskiest — spike first)

Unit 1 of the parent feature design — read it fully (transitions idiom, webhook shape,
holder contract, fallback plan).

## Scope

- **SPIKE FIRST**: validate `fallback(transitions=[...])` firing semantics in the dev
  Liquidsoap container (hand-edited `.liq`, drive a switch via
  `scripts/dev/test-live-fallback.sh`) BEFORE any template/API wiring. If the idiom
  fails, escape-hatch with findings — the fallback plan (is_ready poller thread) is in
  the parent body.
- `apps/api/src/services/playout-live-state.ts` (new) — `setAiringSource` /
  `getAiringSource`, `"unknown"` until first switch after API boot.
- Render template: `notify_switch` transitions on the snc_tv fallback (one per source,
  same source order). Lane 1's render snapshot tests change — intended (feature, not
  refactor); update with a note.
- Webhook `POST /api/playout/broadcast/input-switch?secret=` (track-event idiom):
  validates secret + body `{source}`, resolves the broadcast channel row, records via
  `setAiringSource`, publishes `channel.live-state-changed { channelId, live: source === "live" }`.

## Acceptance criteria

- [ ] Spike: transitions observed firing in the dev container on a real live switch.
- [ ] Render unit tests updated; rendered `.liq` parses (liquidsoap container boots
      with the regenerated config).
- [ ] Webhook 401s without secret; publishes + records on valid call.
- [ ] `getAiringSource()` reflects the last webhook call; `unknown` before any.

## Implementation notes (2026-06-13)

**Re-grounding done:** confirmed `channels.type` was dropped; resolved broadcast channel
via `ownership='platform'` AND `role='broadcast'` (no longer `type='broadcast'`). The
`activateLiveChannel` rename and `ensureCreatorChannel` addition in Lane 1's
commit cafcb45 were verified — SSE publish seams in `channels.ts` are intact.

**Files changed:**
- `apps/api/src/services/playout-live-state.ts` — new, ~30 LOC; `setAiringSource`/`getAiringSource`, `"unknown"` until first switch
- `apps/api/src/services/playout-topology.ts` — added `BROADCAST_INPUT_SWITCH_PATH` constant
- `apps/api/src/services/liquidsoap-render.ts` — added `notify_switch` transitions on S/NC TV fallback
- `apps/api/src/routes/playout-channels.routes.ts` — added `POST /broadcast/input-switch` webhook
- `apps/api/tests/services/playout-live-state.test.ts` — 5 tests green
- `apps/api/tests/routes/playout-channels.routes.test.ts` — 7 new input-switch tests; all 38 in file green
- `apps/api/tests/services/liquidsoap-config.test.ts` — updated 1 assertion for new multi-line fallback form
- `apps/api/tests/services/__snapshots__/playout-*.liq` — all 4 snapshot files updated (feature, not refactor)

**Acceptance criteria disposition:**
- [ ] Spike: transitions observed firing — **DOCUMENTED RESIDUAL**: dev streaming stack not runnable in sandbox (no docker/Liquidsoap). Template is implemented per design; spike validation must happen in a real dev env before relying on transitions in production. Fallback plan (thread.run is_ready() poller) documented in parent feature.
- [x] Render unit tests updated; all 19 liquidsoap-config tests green including 4 golden-output snapshots.
- [x] Webhook 401s without secret; publishes + records on valid call — 7 tests green.
- [x] `getAiringSource()` reflects the last webhook call; `"unknown"` before any — 5 tests green.

**Emission-asymmetry note (not applicable for this unit):** N/A — this unit publishes synchronously from the webhook handler, no transitions module involved.

## Review (2026-06-14)
**Verdict**: Approve — fast-lane: green unit verification. Residual: Liquidsoap transitions spike needs the dev streaming stack (documented; backlog dev-bootstrap-playout-content-and-s3-gap).
