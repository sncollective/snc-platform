---
id: unified-channel-model-editorial-engine-control-client
kind: story
stage: done
tags: [streaming, playout]
parent: unified-channel-model-editorial-engine
depends_on: [unified-channel-model-editorial-engine-render]
release_binding: null
gate_origin: null
created: 2026-06-16
updated: 2026-06-17
---

# Control client extension — armQueue (arm only; mode/manual removed)

## B1-downgrade fix (2026-06-17)

- **Removed `setMode`** from `LiquidsoapClient` interface, real implementation, and stub.
  The `/channels/{channelId}/mode` endpoint is no longer emitted in the rendered `.liq`.
  Mode changes apply via regenerate-and-restart in the control service, not via harbor.
- **Removed `setManualTier`** from `LiquidsoapClient` interface, real implementation, and stub.
  The `/channels/{channelId}/manual` endpoint is no longer emitted in the rendered `.liq`.
  Manual-pin changes apply via regenerate-and-restart.
- **Kept `armQueue`** — the only live editorial-control verb. The `/arm` endpoint remains.
- Also removed unused `harborChannelPaths().mode` and `.manual` usages (those keys were
  removed from `harborChannelPaths` in the topology story's B1 fix).
- Tests: removed `setMode` and `setManualTier` describe blocks from both
  `createLiquidsoapClient` and `createStubLiquidsoapClient` test sections.
- All client tests pass.

Implements **Unit 4** of `unified-channel-model-editorial-engine` (full design in the feature body).
The typed adapter for the new bespoke endpoints.

## Scope
- `apps/api/src/services/liquidsoap-client.ts`: extend `LiquidsoapClient` with `setMode(channelId, mode)`,
  `setPriority(channelId, tier)`, `armQueue(channelId, armed)` — all `Promise<Result<void, AppError>>` —
  calling the new endpoints with the `?secret=` query, reusing the existing `request` helper (timeout +
  structured error mapping).
- `apps/api/src/services/playout-topology.ts`: extend `harborChannelPaths` with `mode` / `priority` / `arm`.
- Mirror the new verbs in `createStubLiquidsoapClient`.

## Acceptance criteria
- [x] Each verb hits the right path with the `?secret=` query and method.
- [x] Failure / timeout / unconfigured map to `AppError` per the existing pattern.
- [x] `harborChannelPaths` returns the new paths; one constant per side of the harbor contract.
- [x] Stub client implements the new verbs (test parity).

## Implementation notes

### Verbs added

Three editorial control verbs added to `LiquidsoapClient` interface and `createLiquidsoapClient` impl in
`apps/api/src/services/liquidsoap-client.ts`:

- `setMode(channelId, mode: "manual" | "auto")` → POST `/channels/{id}/mode`, body = mode string, `?secret=`
- `armQueue(channelId, armed: boolean)` → POST `/channels/{id}/arm`, body = `"true"`/`"false"`, `?secret=`
- `setManualTier(channelId, tierIndex: number)` → POST `/channels/{id}/manual`, body = `String(tierIndex)`, `?secret=`

`setPriority` was **not added** — dropped from the unified model per the revised Unit 4 design.

### `?secret=` handling

A private `requestGuarded(path, body)` helper was added inside `createLiquidsoapClient`. It checks
`config.PLAYOUT_CALLBACK_SECRET` before making any network call:

- **Secret present**: appends `?secret=<encoded>` to the path and delegates to the existing `request` helper.
- **Secret absent**: returns `err(AppError("LIQUIDSOAP_SECRET_NOT_CONFIGURED", ..., 503))` immediately —
  no fetch is issued. This avoids surfacing an opaque 401 from Liquidsoap and makes the misconfiguration
  obvious. The secret is a deployment invariant (set at container start), not a runtime toggle, so fast-fail
  with a clear code is the right shape here.

The existing unguarded verbs (`pushTrack`, `skipTrack`) are unchanged — the queue and skip endpoints are
not secret-guarded per the design.

### `LiquidsoapNowPlaying` shape change

`selected: string` added to the type — the active source label returned by `switch.selected()` in the
rendered `.liq`. `getNowPlaying` implementation unchanged (still a cast-after-parse); the render is
responsible for serializing the label. `uri`, `title`, `elapsed`, `remaining` retained.

### Stub parity

`createStubLiquidsoapClient` extended with `setMode`, `armQueue`, `setManualTier` — each logs at `info`
level and returns `ok(undefined)` with no fetch call.

### `harborChannelPaths`

Already extended with `mode`, `arm`, `manual` paths in `playout-topology.ts` (landed in the render story,
Unit 3). No changes needed here.

### Tests

`apps/api/tests/services/liquidsoap-client.test.ts` — extended:

- `setupModule` now accepts a second `withSecret` param to toggle `PLAYOUT_CALLBACK_SECRET`.
- `makeNowPlayingResponse` updated to include `selected: "queue"`.
- New `describe` blocks: `setMode` (7 cases), `armQueue` (7 cases), `setManualTier` (7 cases) — each
  covering: secret-not-configured early return, API-URL-not-configured, correct path+method+body+secret,
  ok on 200, err on non-2xx, err on unreachable, err on timeout.
- `getNowPlaying` "returns parsed now-playing data" test updated to assert `result?.selected === "queue"`.
- Stub parity: 3 new `it` blocks (`setMode`, `armQueue`, `setManualTier` return ok, no fetch).
- All 1738 tests pass (112 files).

### Discrepancies from story scope

- Story scope listed `setPriority` — dropped per the revised Unit 4 design (unified model has no priority
  concept; the topology uses tier index order instead). `setManualTier` is the replacement.
- Story scope listed `playout-topology.ts` as needing extension — already done in Unit 3 (render story);
  no changes needed.

### Parked

None.

## Review (2026-06-17)

**Verdict**: Approve. No blockers; advanced `review → done` (control-service unblocked).

Read `liquidsoap-client.ts` in full. Verbs route to the correct `?secret=`-guarded harbor paths via
`requestGuarded` (fail-fast 503 `LIQUIDSOAP_SECRET_NOT_CONFIGURED` when the secret is unset — honest, not
an opaque 401); `selected` added to `LiquidsoapNowPlaying`; no `setPriority`; full stub parity. 48 genuine
test cases (assert exact `?secret=` URLs + method/body + the `selected` field + all error paths), no
gaming; 1738 pass. Nit (non-blocking, pre-existing pattern): `getNowPlaying` casts the JSON `as
LiquidsoapNowPlaying` without runtime validation — fine given the render guarantees the shape.
