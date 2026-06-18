---
id: unified-channel-model-snctv-composition-nowplaying-consumer
kind: story
stage: review
tags: [streaming, playout]
parent: unified-channel-model-snctv-composition
depends_on: [unified-channel-model-snctv-composition-topology]
release_binding: null
gate_origin: null
created: 2026-06-18
updated: 2026-06-18
---

# Retire the legacy broadcast now-playing consumer

The static block's legacy `/now-playing` harbor endpoint (`HARBOR_LEGACY_NOW_PLAYING`) is deleted
with the static tail (`topology` story). Its consumer must move to the broadcast channel's
per-channel `selected()`-based now-playing path.

## Scope

**File**: `apps/api/src/services/liquidsoap.ts`

`liquidsoap.ts:20` fetches `HARBOR_LEGACY_NOW_PLAYING` (`/now-playing`). Repoint it at the broadcast
channel's per-channel now-playing harbor path (the generated `selected()`-based endpoint, keyed on
the broadcast channel id).

- Trace every caller of the broadcast now-playing function and confirm response-shape compatibility.
  The per-channel shape `{ uri, title, elapsed, remaining, selected }` is a **superset** of the
  legacy `{ uri, title, elapsed, remaining }` — callers reading the legacy four fields are
  unaffected; `selected` is additive.
- Remove the `HARBOR_LEGACY_NOW_PLAYING` export from `playout-topology.ts` once `liquidsoap.ts` no
  longer imports it (grep for other importers first — expected: none).

## Acceptance criteria
- [ ] `liquidsoap.ts` reads the broadcast channel's per-channel now-playing path; no reference to `HARBOR_LEGACY_NOW_PLAYING` remains.
- [ ] `HARBOR_LEGACY_NOW_PLAYING` export removed — grep confirms no remaining importers.
- [ ] Existing now-playing callers' response-shape expectations still satisfied (additive `selected` field only).
- [ ] `liquidsoap.test.ts` updated: now-playing fetch hits the per-channel path with the compatible shape.

## Implementation (2026-06-18)

**`liquidsoap.ts`**: `getNowPlaying()` now resolves the broadcast channel id (a small
`getBroadcastChannelId` helper queries `ownership=platform, role=broadcast`) and fetches the
**per-channel** path `/channels/<broadcastId>/now-playing` (the `switch.selected()`-based endpoint),
instead of the retired legacy `/now-playing`. Kept the **no-arg signature** so the two callers
(`playout.ts:getPlayoutNowPlaying`, `srs.ts` channel-status enrichment) are unchanged — the
broadcast-channel resolution is encapsulated in the service, mirroring how the input-switch route
already resolves the broadcast channel. Returns null when no broadcast channel is seeded
(un-seeded env) — no fetch attempted.

The per-channel response is a **superset** of the legacy shape (`{ uri, title, elapsed, remaining,
selected }`); the consumer reads the four legacy fields and ignores the additive `selected`.

**`playout-topology.ts`**: removed the `HARBOR_LEGACY_NOW_PLAYING` export — grep-confirmed no
remaining importers (render.ts dropped its use in the `topology` story; `liquidsoap.ts` was the last
consumer).

**Tests** (`liquidsoap.test.ts`): mocked the DB resolution of the broadcast channel; updated the
endpoint assertion to the per-channel path; added a "no broadcast channel → null, no fetch" case and
an "additive `selected` field tolerated" case. 8 passed (was 6 + 2 new).

**Verification**: full API unit suite **1770 passed**; `tsc --noEmit` clean. The `playout.ts` /
`srs.ts` callers compile + pass unchanged (signature preserved).

## Design reference
Feature body §Implementation Units / Unit 4.
