---
id: bold-event-spine-publishers-input-switch
kind: story
stage: implementing
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

## Resume note (2026-06-13 — ready, paused for coordination)

Deps clear; this is the chain's entry point. **Before starting, two re-grounding checks:**
1. **Spike first** (per scope): validate `fallback(transitions=[...])` firing in the dev
   Liquidsoap container BEFORE template/API wiring — only when the shared dev stream is
   free to restart.
2. **`channels.ts` moved under Lane 1.** `unified-channel-model-identity-lifecycle` had
   an in-flight schema migration + `channels.ts`/`streaming.schema.ts` edits at pause
   time. Re-read the broadcast-channel row shape (what the webhook resolves to
   `setAiringSource` + publishes from) against the landed change before wiring the
   webhook — the `type: "broadcast"` lookup may have shifted.
