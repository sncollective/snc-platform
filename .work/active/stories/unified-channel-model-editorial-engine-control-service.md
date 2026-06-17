---
id: unified-channel-model-editorial-engine-control-service
kind: story
stage: done
tags: [streaming, playout]
parent: unified-channel-model-editorial-engine
depends_on: [unified-channel-model-editorial-engine-control-client, unified-channel-model-editorial-engine-config-schema]
release_binding: null
gate_origin: null
created: 2026-06-16
updated: 2026-06-17
---

# Editorial control service + routes + restart wiring

## B1-downgrade fix (2026-06-17)

- **`setMode`**: removed `client.setMode` live-mutate call. Now persists mode to DB then calls
  `regenerateAndRestart()`. Signature updated: no longer takes a `LiquidsoapClient` param.
  Route handler updated: `editorialSetMode(channelId, mode)` (no client arg).
- **`setManualTier`**: removed `client.setMode` + `client.setManualTier` live-mutate calls.
  Now persists `mode=manual` + `manualTierId` then calls `regenerateAndRestart()`. Signature
  updated: no `LiquidsoapClient` param. Route handler updated: `editorialSetManualTier(channelId, tierId)`.
- **`takeQueue` mode-change decision**: if already in auto mode, arm live only (no restart needed —
  checks persisted mode via `getEditorialConfig`). If in manual mode, persist `mode=auto` +
  regenerate-restart, then arm live. This avoids spurious restarts when the operator calls take
  on a channel already in auto. `takeQueue` still takes a `LiquidsoapClient` param (arm is live).
- **`armQueue`**: unchanged — live verb, still takes `LiquidsoapClient`, no restart.
- Tests updated:
  - `setMode`: asserts `mockRegenerateAndRestart` called, no `client.setMode`.
  - `setManualTier`: asserts `mockRegenerateAndRestart` called, no `client.setManualTier`/`setMode`.
  - `takeQueue`: 3 cases — already auto (arm only), from manual (persist+restart+arm), null config
    (defaults to auto, arm only). `mockGetEditorialConfig` added to module setup.
  - `makeMockClient` updated to remove `setMode`/`setManualTier`.
- Route tests: `setMode` and `setManualTier` assertions updated (no `expect.anything()` third arg).
- All control-service and route tests pass.

Implements **Unit 5** of `unified-channel-model-editorial-engine` (full design in the feature body).
Makes the engine controllable — the verbs the editorial UI (out of scope here) will consume.

## Scope
- `apps/api/src/services/editorial-control.ts` (new): live verbs (mode / priority / arm-take) **persist to
  DB and live-mutate** via the client (durable + immediate; restart-agnostic). **Structural** edits (tier
  add/remove, carry-edge add/remove, channel CRUD) persist then trigger the **existing
  regenerate-and-restart** path (re-render `.liq` + restart — the path already invoked on channel
  create/delete). Validates against config + role/ownership. Returns `Result<…, AppError>`.
- `apps/api/src/routes/playout.routes.ts`: thin role-scoped handlers delegating to the service.

## Acceptance criteria
- [x] Each route has happy-path + auth-failure tests (AGENTS testing convention).
- [x] Live verbs persist to DB AND call the client; a restart restores state from persisted config.
- [x] A structural edit triggers regenerate-and-restart; a live verb does not.
- [x] The two workshop scenarios are expressible without a playout reset: "build a queue while the pool
      rotates, switch over when ready" (arm/take) and "choose the scheduled event over the live creator"
      (priority pin / manual).
- [ ] Live-mutate round-trip against a real pipeline noted as an integration/staging check (no container
      in unit).

## Implementation notes

### Part 1 — `editorial-control.ts` service

**File**: `apps/api/src/services/editorial-control.ts` (new, 402 lines)

**Live verbs (persist + live-mutate, no restart):**
- `setMode(channelId, mode, client)` — persists via `upsertEditorialConfig` then calls `client.setMode`. Client failure is best-effort (warning logged); persist always wins for restart-agnostic state.
- `armQueue(channelId, armed, client)` — calls `client.armQueue` only. **Arm state is NOT persisted** (load-bearing decision: arm/take is operator intent for a live session; persisting would auto-arm after unexpected restarts, surprising the operator; the render initializes `armed=false` on every restart).
- `takeQueue(channelId, client)` — convenience verb: persists `mode=auto` then live-mutates `arm=true` + `mode=auto`. Implements "build a queue while pool rotates, take when ready".
- `setManualTier(channelId, tierId, client)` — resolves the tier's index among enabled tiers (for the Liquidsoap `${vid}_manual` ref), persists `mode=manual + manualTierId`, then live-mutates mode + tier index. Implements "choose the scheduled event over the live creator".

**Structural verbs (persist + regenerate-and-restart):**
- `setTierEnabled(tierId, enabled)` — `updateEditorialTier` then `regenerateAndRestart`.
- `setTierPriority(tierId, priority)` — `updateEditorialTier` then `regenerateAndRestart`.
- `addCarryEdge(channelId, sourceChannelId, priority)` — `createEditorialTier` then `regenerateAndRestart`.
- `removeTier(tierId)` — `deleteEditorialTier` then `regenerateAndRestart`.

**Regenerate-and-restart mechanism reused**: `regenerateAndRestart()` from `liquidsoap-config.ts` — writes the generated `.liq` to the mounted volume, then POSTs to the `/admin/shutdown?secret=...` harbor endpoint. Liquidsoap exits; Docker restart policy brings it back with the new config. This is the same path used for channel create/delete in `playout-channels.routes.ts`.

**Pool resolution**: `resolvePoolNextUri(channelId, scope)` — queries `channel_content` for the channelId in LRP order (`lastPlayedAt ASC nulls first`), resolves the first item to an S3 URI (1080p → 720p → 480p → source), updates `lastPlayedAt=now + playCount++` via `sql\`playCount + 1\`` (Drizzle-idiomatic). Batches 20 rows to skip unresolvable items. Scope is enforced at seed time (channel_content rows are channelId-bounded); runtime query is always channelId-filtered.

**Ownership validation**: leans on `editorial-config.ts` CRUD validators (creator own-source-only, admin key-XOR-carry) — channel existence checked via `fetchPlayoutChannel`, tier validation delegated.

### Part 2 — pool/next callback endpoint

**File**: `apps/api/src/routes/playout-channels.routes.ts` (added pool/next route)

`GET /api/playout/channels/:channelId/pool/next?secret=<PLAYOUT_CALLBACK_SECRET>`

- Secret-guarded (same pattern as track-event + input-switch): `PLAYOUT_CALLBACK_SECRET` query param must match config. On 401 returns empty body (Liquidsoap sees empty = pool not-ready, safe for fallback).
- Resolves channel ownership → `poolContentScope` → `resolvePoolNextUri`.
- Returns URI as **plain text** (`c.text(uri)`); empty string when pool is empty or channel not found (safe degradation — not-ready, not an error).
- Registered as a `GET` (not behind `requireAuth`/`requireRole`) — callback-style route like track-event.
- Contract matches the `.liq` render: `http.get(poolNextUrl)` → `if uri == "" then null() else request.create(uri) end`.

### Part 3 — editorial control routes

**File**: `apps/api/src/routes/playout.routes.ts` (added editorial block)

Routes added under `/api/playout/channels/:channelId/editorial/*`:
- `POST /mode` — `{ mode: "manual" | "auto" }` → `editorialSetMode`
- `POST /arm` — `{ armed: boolean }` → `editorialArmQueue`
- `POST /take` — no body → `editorialTakeQueue`
- `POST /manual` — `{ tierId: string }` → `editorialSetManualTier`

All routes: `requireAuth + requireRole("admin")` (creator-scoped access arrives with creator-enablement story). `validator + describeRoute` per convention. Thin handlers — all business logic in the service.

### Arm-persistence decision

Arm state is **NOT persisted** (transient live-only). Rationale: arm/take is operator intent for an active live session; auto-arming after an unexpected restart would surprise the operator. The render initializes `${vid}_armed = ref(false)` on every Liquidsoap startup. The operator re-arms after a restart if still desired. `takeQueue` persists `mode=auto` (which IS the durable intent) but not the arm signal.

### Ownership-scoping decision

Pool scope is enforced at seed time (when content is assigned to `channel_content`). The `resolvePoolNextUri` function passes `scope` through to the service but the runtime query is always `channelId`-bounded — each channel's `channel_content` rows already reflect its ownership scope. Creator channels' pools contain only that creator's content; admin channels' pools contain all creators' content. No runtime join needed.

### Tests

- `tests/services/editorial-control.test.ts` — 16 tests: setMode (3), armQueue (2), takeQueue (1), setManualTier (3), setTierEnabled (2), addCarryEdge (1), removeTier (1), resolvePoolNextUri (4).
- `tests/routes/editorial-control.routes.test.ts` — 23 tests: mode route (5: 200, 403, 401, 400, 404), arm route (3: 200, 403, 401), take route (3: 200, 403, 401), manual route (4: 200, 403, 401, 400), pool/next (7: happy path, empty pool, channel not found, wrong secret, missing secret, scope delegation, creator scope).
- Total new: 39 tests. All pass. Full suite: 1777 passed (up from 1738).

### Discrepancies / parked

- **No `setTierPriority` route**: structural edit verbs (setTierEnabled, addCarryEdge, removeTier, setTierPriority) are in the service but not wired as routes. The editorial UI (playout-admin-redesign) is out of scope for this story; when it lands it will add routes for these structural edits. The service functions are ready.
- **Live-mutate round-trip**: not tested in unit (no container). Integration/staging check noted.
- **Creator-scoped access**: editorial routes are admin-only. Creator-scoped access (a creator managing their own channel) arrives with the creator-enablement story.

## Review (2026-06-17)

**Verdict**: Approve with comments. No blockers; advanced `review → done` (final link — feature complete).

Read `editorial-control.ts` in full + verified the seams. Confirmed: `regenerateAndRestart` is a real
liquidsoap-config.ts export (writes `.liq` + POSTs `/admin/shutdown` → container restart); the pool/next
route `/api/playout/channels/:channelId/pool/next` matches the render's `http.get` URL exactly (plain-text
URI body / empty when pool empty / secret-guarded); live verbs persist-then-mutate; `setManualTier`
resolves the **enabled-tier** index (matches the render's switch order); arm transient (documented);
39 genuine tests, 1777 pass.

**Important finding (filed → `editorial-render-followups`; design reconciled):** the pool draws from
`channel_content` `channelId`-bounded (curated per-channel), NOT the design's ownership-scoped library
auto-draw — `poolContentScope` is `void`ed at query time. Defensible MVP and consistent with deferring the
admin-content/hidden-creator work, but narrower than stated; the feature body's pool-scope decision is
updated to reflect MVP reality + the deferral.

**Pending (feature-level):** end-to-end staging walk on a real pipeline (pool resolution + LRP rotation,
multi-tier readiness fallback, arm/take + manual-pin live, regenerate-and-restart) — runtime behavior the
unit suite + `liquidsoap --check` can't cover.
