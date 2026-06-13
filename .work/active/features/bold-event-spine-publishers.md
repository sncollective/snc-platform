---
id: bold-event-spine-publishers
kind: feature
stage: implementing
tags: [streaming, playout]
release_binding: null
depends_on: [bold-event-spine-sse-endpoint, bold-lifecycle-transitions-playout-queue]
gate_origin: null
created: 2026-06-12
updated: 2026-06-13
parent: bold-event-spine
---

# Event publishers at the points of knowledge

## Brief
Emit spine events from the handlers that already learn about state changes: the SRS
on_publish/on_unpublish callbacks (live channel up/down), the Liquidsoap track-event
handler (queue advanced), and media job completion (processing status). Fire-and-forget
semantics — publishing must never affect the callback/job result.

Cross-epic dependency on `bold-lifecycle-transitions-playout-queue`: queue events attach
to that module's named transitions rather than being sprinkled through the orchestrator;
if transitions are centralized first, this feature is a few lines per transition instead
of a second scattering.

## Input from live-experience-redesign epic design (2026-06-12)
The live-state truth decision (user call) adds a publisher source this brief didn't
name: **Liquidsoap input-switch telemetry** — which source the playout engine is
actually airing (live input vs playout fallback), so `channel.live-state-changed`
covers takeovers that bypass SRS, not just keyed on_publish/on_unpublish sessions.
The track-event handler path Liquidsoap→API already exists; input-switch events
should ride the same mechanism. `live-experience-redesign-live-state` depends on
this feature and consumes that event.

## Carry-over from sse-endpoint review (2026-06-13)
Two verification residues from the endpoint feature land here as acceptance lines:
- Add one route test wiring a REAL `createEventBus()` into `createSseRoutes({bus})`
  and asserting a `bus.publish()` after connect arrives as an HTTP frame — the only
  seam composition never exercised (endpoint route tests use a mock bus).
- Prove one live-state event end-to-end on the real wire (SRS on_publish → channels
  service → bus → SSE frame) — the endpoint's proof story covered lifecycle through
  Caddy but no real event ever traversed the full path.

## Design decisions

- **Queue events publish from inside the transitions module** — the lifecycle feature's
  module header already names itself the side-effect attachment point; publishing from
  call sites would re-scatter what that refactor just centralized. `eventBus.publish` is
  sync and never throws into callers, satisfying fire-and-forget by construction.
- **Event mapping**: `markPlayed`/`promoteNext` → `playout.now-playing-changed`
  `{channelId}`; `enqueue`/`enqueueBatch`/`removeQueued` → `playout.queue-changed`
  `{channelId}`. Payloads are notification hints (entity key only) per the endpoint
  feature's settled semantics — admin UI re-fetches `/api/playout/status`. A track
  advance fires both types; per-connection coalescing collapses bursts.
- **`playout.engine-restarted` is in scope** (point of knowledge exists:
  `regenerateAndRestart` succeeds) — `playout-admin-redesign-live-data` consumes it.
  **`playout.config-drift` is deferred**: no detection mechanism exists yet;
  `bold-channel-topology-drift-detection` (drafting) owns building one — the event
  lands there, riding this feature's registry.
- **`channel.viewer-count` is deferred out of this feature**: SRS has no viewer-count
  push callback, so it needs a server-side poller — new machinery, not a "publisher at
  a point of knowledge". One server-side poller is still a win over N clients polling;
  park for the redesign epics to demand. Polling survives as the epic's sanctioned
  fallback meanwhile.
- **Input-switch payload stays `{channelId, live}`** (the existing
  `channel.live-state-changed` shape, published for the broadcast channel with
  `live = (source == "live")`): under notification semantics the client re-fetches; the
  *snapshot* side gains a tri-state in-memory holder (`live` / `fallback` / `unknown`)
  exposed via a getter for `live-experience-redesign-live-state` to wire into the
  status endpoint. `unknown` until the first switch after API boot — honest gap, named
  for the consuming feature (mitigation like a Liquidsoap state heartbeat is theirs to
  demand). No DB column — ephemeral engine state doesn't belong in the channel row.
- **Liquidsoap switch detection via `fallback(transitions=[...])`** — one transition
  function per source in the snc_tv chain, side-effecting an `http.post` to a new
  shared-secret webhook (same mechanism as track-event) and returning the new source
  unchanged. **Spike-first**: the reference doesn't pin per-source transition firing
  semantics in 2.4, so the story validates the idiom in the dev Liquidsoap container
  before any API wiring (precedent: the Phase 5 fallback-switching spike). Fallback
  plan if transitions misbehave: a `thread.run` poller on `live_source.is_ready()`
  posting on ref change.
- **`content.processing-status-changed` publishes from the `updateContentProcessing`
  chokepoint** (all content job handlers route through it), only when
  `updates.processingStatus` is present (codec/dimension updates don't spam), using
  `.returning()` to surface `creatorId` + new status in the same statement. This
  placement survives the sibling `bold-lifecycle-transitions-content-processing`
  feature (it will centralize callers around the same chokepoint). Playout-item
  processing (`playout-ingest.ts`) is NOT included — different table, admin-only
  surface, no named consumer yet.
- **Content scope filter: connect-time `creatorIds` on `SubscriberContext`** — the SSE
  route resolves the user's creator memberships (`creator_members`) once at connect;
  the registry's `scopeFilter` passes events where `event.creatorId ∈ ctx.creatorIds`
  or the connection holds the admin role. Team-aware (alternative — `ownerUserId` on
  the event — breaks for multi-member creators). Staleness bounded by connection
  lifetime, consistent with the endpoint's settled topic-grant staleness.
- **Advisory pass skipped deliberately**: the endpoint feature's advisory findings
  (notification-hint semantics, coalescing, the content-filter registry fence) are the
  binding constraints on this design; the one open risk (Liquidsoap transitions idiom)
  is fenced by the spike-first acceptance criterion.

## Architectural choice

Attach publishes at the four existing points of knowledge (transitions module, SRS
callback path — already landed as the proof event, Liquidsoap webhook family, media-job
chokepoint) plus one new point (input-switch webhook). Rejected: a publish-decorator
layer over services (indirection with one consumer); DB triggers/outbox (epic forbids
broker-shaped machinery; single process); polling SRS/Liquidsoap state into events
(inverts the epic's thesis — the server already learns first everywhere except viewer
counts, which stay deferred).

## Implementation Units

### Unit 1 (riskiest): Liquidsoap input-switch telemetry
**Files**: `apps/api/src/services/liquidsoap-render.ts`,
`apps/api/src/services/playout-topology.ts` (webhook path constant),
`apps/api/src/routes/playout-channels.routes.ts` (webhook route),
`apps/api/src/services/playout-live-state.ts` (new, ~30 LOC)
**Story**: `bold-event-spine-publishers-input-switch`

```ts
// playout-live-state.ts — ephemeral airing-state holder
export type AiringSource = "live" | "queue" | "fallback" | "unknown";
/** Record the source the broadcast fallback switched to. */
export const setAiringSource = (source: AiringSource): void;
/** Latest known airing source ("unknown" until first switch after API boot). */
export const getAiringSource = (): AiringSource;
```

```liquidsoap
# render template — transitions on the snc_tv fallback (one per source, same order)
def notify_switch(name) =
  fun (_, b) -> begin
    ignore(http.post(headers=[("Content-Type", "application/json")],
      data='{"source":"#{name}"}',
      "http://#{api_host}:#{api_port}/api/playout/broadcast/input-switch?secret=#{callback_secret}"))
    b
  end
end
snc_tv = fallback(track_sensitive=false,
  transitions=[notify_switch("live"), notify_switch("queue"), notify_switch("fallback"), notify_switch("blank")],
  [live_source, snc_tv_queue, ${t.broadcast.fallbackSourceVar}, mksafe(blank())])
```

Webhook (same idiom as track-event: shared-secret query param, zod body
`{ source: "live"|"queue"|"fallback"|"blank" }`): resolves the broadcast channel row
(type `broadcast`), `setAiringSource(...)`, publishes `channel.live-state-changed`
`{ channelId, live: source === "live" }`. Blank maps to holder value `fallback` (both
are "not live"; the distinction isn't load-bearing for any named consumer).

**Implementation Notes**:
- **Spike FIRST**: hand-edit the rendered `.liq` in the dev container (or a scratch
  copy) and verify transitions fire on live up/down (`scripts/dev/test-live-fallback.sh`
  drives a switch) BEFORE wiring template + webhook. If the idiom fails, escape-hatch
  the story with findings (fallback plan in Design decisions).
- Lane 1's model-render snapshot tests will change — that is correct and intended
  (this is a feature, not a refactor); update snapshots with a note.

**Acceptance Criteria**:
- [ ] Spike: transitions observed firing in the dev container on a real live switch.
- [ ] Render unit tests updated; rendered `.liq` parses (liquidsoap container boots).
- [ ] Webhook 401s without secret; publishes + records on valid call.
- [ ] `getAiringSource()` reflects the last webhook call; `unknown` before any.

### Unit 2: Queue + engine publishers
**Files**: `apps/api/src/services/playout-queue-transitions.ts`,
`apps/api/src/services/liquidsoap-config.ts`, `packages/shared/src/events.ts`,
`apps/api/src/services/event-bus.ts` (registry entries)
**Story**: `bold-event-spine-publishers-queue-events`

```ts
// shared/events.ts — add to the discriminated union
export const PlayoutQueueChangedSchema = z.object({
  type: z.literal("playout.queue-changed"),
  channelId: z.string(),
});
export const PlayoutNowPlayingChangedSchema = z.object({
  type: z.literal("playout.now-playing-changed"),
  channelId: z.string(),
});
export const PlayoutEngineRestartedSchema = z.object({
  type: z.literal("playout.engine-restarted"),
});
```

Registry: all three on topic `playout`; coalesce keys `channelId` / `channelId` /
static `"engine"`. Publishes: end of `markPlayed` + `promoteNext` (now-playing), end of
`enqueue` + `enqueueBatch` (when count > 0) + `removeQueued` success path
(queue-changed), and `regenerateAndRestart` success (engine-restarted).

**Acceptance Criteria**:
- [ ] Transition unit tests assert publishes (spy bus) without weakening existing
      assertions; orchestrator suite green unchanged.
- [ ] Exhaustive-registry compile check still holds (new union members force entries).

### Unit 3: Content processing publisher + scope filter
**Files**: `apps/api/src/services/processing-jobs.ts`, `packages/shared/src/events.ts`,
`apps/api/src/services/event-bus.ts`, `apps/api/src/routes/sse.routes.ts`
**Story**: `bold-event-spine-publishers-content-events`

```ts
// shared/events.ts
export const ContentProcessingStatusChangedSchema = z.object({
  type: z.literal("content.processing-status-changed"),
  contentId: z.string(),
  creatorId: z.string(),
  status: z.string(), // ProcessingStatus values; hint only — client re-fetches
});
```

`updateContentProcessing`: when `updates.processingStatus` present, add
`.returning({ creatorId: content.creatorId, processingStatus: content.processingStatus })`
and publish. `SubscriberContext` gains `creatorIds: string[]`; the SSE route fills it at
connect (one `creator_members` query by userId — only when the `content` topic is
granted, anon connections skip the query). Registry entry: topic `content`,
coalesceKey `contentId`, scopeFilter
`(e, ctx) => ctx.roles.includes("admin") || ctx.creatorIds.includes(e.creatorId)`.

**Acceptance Criteria**:
- [ ] Status-bearing update publishes; codec-only update does NOT.
- [ ] scopeFilter: member sees own-creator events, not others'; admin sees all.
- [ ] Existing event-bus + sse.routes tests green (SubscriberContext extension is
      additive; mock subs gain the field).

### Unit 4: Wire proofs (carry-overs)
**Files**: `apps/api/tests/routes/sse.routes.test.ts` (real-bus composition test),
`apps/api/scripts/sse-smoke.ts` (extend: `--expect-event` mode)
**Story**: `bold-event-spine-publishers-wire-proofs`

- Route test: `createSseRoutes({ bus: createEventBus() })`, connect, `bus.publish(...)`,
  assert the typed frame arrives on the HTTP response stream (the only seam never
  composed).
- Dev-wire proof A (webhook path): Bun script POSTs to the input-switch webhook with
  the secret while an SSE client holds `?topics=live` through Caddy — assert the
  live-state frame arrives (proves webhook → bus → SSE on the real wire).
- Dev-wire proof B (SRS path): drive a real stream start/stop via
  `scripts/dev/test-live-fallback.sh` (or ffmpeg if available) and observe the
  on_publish-sourced event. If the dev env can't drive RTMP in-session, record honestly
  what was and wasn't observed — proof A already covers the composed wire path.

**Acceptance Criteria**:
- [ ] Real-bus route test green.
- [ ] Webhook→SSE frame observed through Caddy (script output in story notes).
- [ ] SRS-path e2e observed OR honestly documented as residual with proof-A coverage
      noted.

## Implementation Order
1. `bold-event-spine-publishers-input-switch` (riskiest — spike fence)
2. `bold-event-spine-publishers-queue-events`
3. `bold-event-spine-publishers-content-events`
4. `bold-event-spine-publishers-wire-proofs`

Sequential chain — units 2 and 3 both edit the shared union + registry; unit 4 needs
units 1–3's events live.

## Testing
Unit tests per unit above (spy-bus publishes, scopeFilter matrix, holder state); the
existing orchestrator/transitions/sse suites are behavior pins and stay green
unchanged; wire proofs via the extended smoke script through Caddy.

## Risks
- **Liquidsoap `transitions` semantics** (the riskiest assumption) — fenced by
  spike-first AC; named fallback plan (is_ready poller thread) in Design decisions.
- **Engine restart churn**: every `regenerateAndRestart` rewrites `playout.liq`;
  template changes here trigger restarts in dev — coordinate timing with anyone using
  the shared dev stream (lanes share the env).
- **`unknown` airing state after API restart** — named gap, carried to
  `live-experience-redesign-live-state`.
- **Snapshot-test churn** on Lane 1's render tests — intended; note in commit.

## Note from lifecycle-playout-queue review (2026-06-13)
Emission-point asymmetry in the landed transitions module: `promoteNext`/`enqueue`
return the affected row (emit directly), but `markPlayed` returns void and
`enqueueBatch` returns only a count. For the queue-events story, either pass the
in-hand `playing` row at the orchestrator call site or extend `markPlayed`'s signature
— decide intentionally rather than re-querying by reflex.
