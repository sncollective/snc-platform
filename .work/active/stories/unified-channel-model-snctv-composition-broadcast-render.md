---
id: unified-channel-model-snctv-composition-broadcast-render
kind: story
stage: implementing
tags: [streaming, playout]
parent: unified-channel-model-snctv-composition
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-18
updated: 2026-06-18
---

# Render the broadcast-role live tier (+ source-switch telemetry)

Teach the pure Liquidsoap render to emit S/NC TV's broadcast affordances, keyed on channel
`role`, so the broadcast channel can render through the unified `renderChannelBlock` path instead
of the static tail. No consumer wiring here — this story is the pure render change; the broadcast
channel doesn't reach the topology until the `topology` story.

## Scope

**File**: `apps/api/src/services/liquidsoap-render.ts`

1. **`renderTierSource` `live` case** — when `ch.role === "broadcast"`, render the real broadcast
   RTMP input as the live source:
   ```ts
   if (ch.role === "broadcast") {
     const liveVar = `${vid}_live`;
     return {
       varName: liveVar,
       declaration: `${liveVar} = input.rtmp(listen=true, "rtmp://0.0.0.0:${t.broadcastInputPort}/live/stream")`,
     };
   }
   return null; // non-broadcast live tier deferred (I2) — unchanged
   ```
   This is the ONLY channel for which a `live` tier produces real `.liq`. The I2 port-1936
   collision deferral stays in force for every other role (still `return null`).

2. **Source-switch telemetry (broadcast only)** — the broadcast channel's generated switch/fallback
   must post the selected-source name to `${BROADCAST_INPUT_SWITCH_PATH}`
   (`/api/playout/broadcast/input-switch`) on each source switch — the live-state spine integration
   today's `notify_switch` transitions provide. Emit a `notify_switch`-equivalent for the broadcast
   role only (role-conditioned, like the live tier). The existing route + its consumer are
   unchanged.

3. **Now-playing** — the broadcast channel uses the standard generated `switch.selected()`
   now-playing harbor path. Do NOT emit the legacy `/now-playing` path or the `on_metadata`
   `snc_tv_uri`/`snc_tv_title` refs (those are retired in the `topology` story when the static tail
   is deleted).

`ch.role` must be available on `PlayoutChannelTopology` — the `topology` story adds it to the row +
topology types. This story can land the render logic guarded on `ch.role === "broadcast"`; until the
topology carries the broadcast channel + role, the branch is dormant (no broadcast channel in
`channels[]` yet). Sequence: this story first (pure, dormant), then `topology` activates it.

## Acceptance criteria
- [ ] Broadcast-role channel renders a `live` tier as the `:1936` `input.rtmp` listener; non-broadcast channels still render `live` → `null`.
- [ ] The broadcast channel's switch posts source-switch events to `/api/playout/broadcast/input-switch`.
- [ ] The broadcast channel renders the standard `selected()`-based now-playing; no legacy `/now-playing`, no `on_metadata` refs in the generated block.
- [ ] Render stays pure / byte-deterministic for a given topology.
- [ ] `liquidsoap-render.test.ts` covers: broadcast live render, non-broadcast null, broadcast telemetry presence, broadcast now-playing shape.

## Design reference
Feature body `unified-channel-model-snctv-composition` §Implementation Units / Unit 1.
