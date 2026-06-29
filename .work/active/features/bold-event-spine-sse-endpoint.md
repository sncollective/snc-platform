---
id: bold-event-spine-sse-endpoint
kind: feature
stage: done
tags: [streaming]
release_binding: 0.4.0
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-13
parent: bold-event-spine
---

# SSE event spine endpoint

## Brief
A single server-sent-events endpoint (Hono `streamSSE`) carrying typed platform events
(initially: playout queue changes, live channel up/down, content processing status).
Design must settle: auth model (cookie session on the EventSource request; per-event
authorization vs. per-topic streams), reconnect + catch-up semantics (`Last-Event-ID`
replay vs. snapshot-on-connect — snapshot is likely sufficient since all current
consumers re-fetch cheaply), in-process fan-out (single API process today — no broker;
do not build one), and heartbeat/timeout behavior behind Caddy.

Riskiest child — the connection lifecycle is the part that can quietly not work in
production (proxy buffering, idle timeouts). Design first via
/agile-workflow:feature-design; prove it with a minimal event type end-to-end before the
publishers feature fans out.

## Design decisions

- **Route path**: `GET /api/sse` — NOT `/api/events` (collides with the calendar
  namespace: `app.route("/api/events/upcoming", …)` already exists). Transport-named is
  accurate: this is and will remain the SSE endpoint.
- **Topology**: single multiplexed endpoint with per-connection topic grants, not
  per-topic endpoints — dev runs plain HTTP through Caddy (HTTP/1.1, 6 connections per
  origin shared across tabs), so connection count is the scarce resource. New topics are
  registry entries, not new routes. WebSocket rejected by the epic (speculative
  generalization; loses EventSource auto-reconnect for free).
- **Auth**: Better Auth cookie session via `optionalAuth` — EventSource cannot set
  headers; web is same-origin through Caddy so cookies flow. Topic grants computed once
  at connect from roles: `live` public, `playout` admin-role, `content` authenticated +
  per-event ownership filter (see registry fence below). Unauthorized-but-known topics
  are narrowed, echoed as `denied` in the `spine.connected` event; **unknown topic names
  are 400** (fail-fast — a typo'd `playuot` must not look like a permission denial);
  missing/empty `topics` param is 400.
- **Event semantics — notification hints, not state**: every event means "this changed,
  re-fetch your snapshot endpoint". Payloads carry entity keys + minimal context, never
  authoritative state. This kills the connect-time race (event arriving while the
  snapshot fetch is in flight cannot be "overwritten" — the client just fetches again)
  and makes queue coalescing lossless.
- **Catch-up**: snapshot-on-connect via client REST re-fetch on EventSource `open`. No
  `Last-Event-ID` replay buffer, and **no `id:` field emitted at all** — a per-process
  monotonic id regresses across PM2 restarts, so emitting it now would create a false
  replay affordance clients could come to depend on. Server ignores `Last-Event-ID`.
  Replay later is an additive contract change (epoch-prefixed ids).
- **Fan-out**: in-process module bus (single API process; the epic forbids a broker).
  Per-connection queue **coalesces latest-per-(event type, entity key)** — under
  notification semantics the latest hint subsumes earlier ones, so bursts (bulk queue
  edits, viewer-count ticks) cost bounded memory and no reconnect storm.
  Close-on-overflow survives only as a backstop at a generous cap.
- **Lifetime bounds**: connection closes at `min(jittered 4h ± 15%, session.expiresAt)`.
  The jitter prevents deploy-synchronized reconnect herds from re-synchronizing every
  4h; the session bound means auth staleness never exceeds session lifetime. **Accepted
  risk**: an admin whose role is revoked mid-connection (session still valid) keeps
  receiving `playout` events until the connection closes — bounded by session expiry /
  4h; named here so the security gate doesn't re-litigate.
- **Herd damping**: jittered `retry:` (2–5s) sent on connect; per-IP rate limit on the
  connect (the existing `rateLimiter`, 30/min) — on the 503 capacity-reject path
  EventSource never sees `retry:` and hammers at its default ~3s, so the rate limiter is
  the only available lever.
- **Heartbeat**: SSE comment every 25s, written from the handler loop (event-driven
  alone closes a Hono SSE stream). Write failure — heartbeat or event — is the
  authoritative connection-death signal (cleanup in `finally`); `stream.onAbort` is the
  fast path only, since abort propagation through Caddy + @hono/node-server is not
  trusted.
- **Proof event payload deliberately thin** (`{ channelId, live }`): the real live-state
  truth (Liquidsoap input-switch telemetry) is the publishers feature's scope — the
  shape must not pre-commit it (substrate-before-stance).

## Architectural choice

Single multiplexed SSE endpoint + typed in-process event bus + declarative topic
registry in `@snc/shared`. Rejected alternatives: per-topic endpoints (connection-limit
math in dev, route sprawl), WebSocket spine (epic-forbidden), broker/outbox (single
process today — explicitly out of scope). The registry is the SSOT: event types, their
topic membership, the topic's access level, and (for scoped topics) the per-event filter
contract all live in one structure; the route and bus derive from it.

## Implementation Units

### Unit 1: Event taxonomy + topic registry
**File**: `packages/shared/src/events.ts` (+ export from `packages/shared/src/index.ts`)
**Story**: `bold-event-spine-sse-endpoint-types-bus`

```ts
import { z } from "zod";

// ── Platform events (discriminated union on `type`) ──
export const ChannelLiveStateChangedSchema = z.object({
  type: z.literal("channel.live-state-changed"),
  channelId: z.string(),
  live: z.boolean(),
});
// Placeholder schemas for publisher-feature events land with their publishers;
// the union starts with the proof event only. Do NOT pre-define payload shapes
// the publishers feature owns.
export const PlatformEventSchema = z.discriminatedUnion("type", [
  ChannelLiveStateChangedSchema,
]);
export type PlatformEvent = z.infer<typeof PlatformEventSchema>;

// ── Topics ──
export const SSE_TOPICS = ["live", "playout", "content"] as const;
export type SseTopic = (typeof SSE_TOPICS)[number];
export type TopicAccess = "public" | "authenticated" | "admin";

/** topic → access level. Event-type → topic mapping is API-side (registry). */
export const TOPIC_ACCESS: Record<SseTopic, TopicAccess> = {
  live: "public",
  playout: "admin",
  content: "authenticated",
};

// ── Protocol meta (NOT in the PlatformEvent union) ──
export const SpineConnectedSchema = z.object({
  granted: z.array(z.enum(SSE_TOPICS)),
  denied: z.array(z.enum(SSE_TOPICS)),
});
export type SpineConnected = z.infer<typeof SpineConnectedSchema>;
```

**Implementation Notes**:
- `spine.connected` and heartbeats are protocol meta, not platform events — heartbeats
  are SSE comments (`: heartbeat`), `spine.connected` is sent with `event: spine.connected`.
- Platform events are sent with `event: <type>` and JSON payload as `data:`.

**Acceptance Criteria**:
- [ ] `PlatformEventSchema` parses the proof event; unknown `type` rejects.
- [ ] Exported from `@snc/shared` index; `@snc/shared` build + tests green.

### Unit 2: Event bus with per-connection coalescing
**File**: `apps/api/src/services/event-bus.ts`
**Story**: `bold-event-spine-sse-endpoint-types-bus`

```ts
import type { PlatformEvent, SseTopic } from "@snc/shared";

/** Per-event ownership filter for scoped topics. REQUIRED for `content` events —
 * the registry contract is the fence that stops a publisher landing before the
 * filter exists (any authenticated user would otherwise see every creator's events). */
export type EventScopeFilter = (event: PlatformEvent, ctx: SubscriberContext) => boolean;

export interface SubscriberContext {
  userId: string | null;
  roles: string[];
}

export interface EventTypeEntry {
  topic: SseTopic;
  /** Entity key extractor for coalescing — latest event per (type, key) wins. */
  coalesceKey: (event: PlatformEvent) => string;
  /** Required when topic access is scoped beyond the topic grant. */
  scopeFilter?: EventScopeFilter;
}

export interface Subscription {
  /** Pull next batch; resolves on enqueue or after timeoutMs (empty array = heartbeat turn). */
  next(timeoutMs: number): Promise<PlatformEvent[]>;
  close(): void;
}

export interface EventBus {
  publish(event: PlatformEvent): void;          // sync, never throws into publishers
  subscribe(topics: SseTopic[], ctx: SubscriberContext): Subscription;
  closeAll(): void;                              // graceful shutdown
  connectionCount(): number;
}

export function createEventBus(): EventBus;      // factory for tests
export const eventBus: EventBus;                 // module singleton (project pattern)
```

**Implementation Notes**:
- Coalescing map per connection: `Map<"<type>:<key>", PlatformEvent>` preserving
  insertion order; `next()` drains it. Backstop: if the map exceeds 256 entries, close
  the subscription (should be unreachable under coalescing — log it).
- `publish` resolves the registry entry, checks topic membership + scopeFilter per
  subscriber, enqueues, wakes the pending `next()`. Errors are caught and logged —
  publishers must never see a throw.
- Registry (`EVENT_REGISTRY: Record<PlatformEvent["type"], EventTypeEntry>`) lives in
  this module — API-side, since scope filters need API context. Exhaustive record keeps
  it in lockstep with the shared union (compile error on missing entry).

**Acceptance Criteria**:
- [ ] Subscriber receives only events whose topic is in its grant set.
- [ ] `scopeFilter` excludes non-matching subscribers.
- [ ] Burst of N same-key events → exactly 1 delivered after drain (coalescing).
- [ ] `next(timeout)` resolves empty on timeout (heartbeat turn); resolves promptly on publish.
- [ ] `closeAll()` resolves all pending `next()` and marks subscriptions closed.
- [ ] Publish to zero subscribers / after closeAll is a no-op, no throw.

### Unit 3: SSE route
**File**: `apps/api/src/routes/sse.routes.ts`
**Story**: `bold-event-spine-sse-endpoint-route`

```ts
export const sseRoutes: Hono<OptionalAuthEnv>;
// GET /  → streamSSE
//   validator("query", z.object({ topics: z.string().min(1) }))  → 400 if missing
//   parse topics CSV → dedupe → unknown name → 400 ValidationError
//   grants = topics.filter(byAccessLevel(user, roles)); denied = rest
//   reject if connectionCount() >= MAX_CONNECTIONS (1000) → 503
//   streamSSE:
//     write retry: <jittered 2000-5000>
//     write spine.connected { granted, denied }
//     deadline = min(now + 4h ± 15%, session?.expiresAt)
//     try { loop: events = await sub.next(25_000);
//           write events or ": heartbeat"; break past deadline }
//     finally { sub.close() }   // write failure = death signal; onAbort = fast path
```

**Implementation Notes**:
- `Cache-Control: no-store, no-transform` set explicitly (future-proofs against a Caddy
  `encode` directive buffering the stream; no compression exists today).
- Heartbeat interval + max lifetime + max connections injected via options on a
  `createSseRoutes(deps)` factory (project test pattern) so route tests don't hang.
- Per-IP `rateLimiter({ windowMs: 60_000, max: 30 })` on the route.
- `describeRoute` documents `text/event-stream` + 400/503.

**Acceptance Criteria**:
- [ ] Unauthenticated `?topics=live` → 200, `spine.connected` with `granted:["live"]`.
- [ ] Unauthenticated `?topics=live,playout` → `granted:["live"], denied:["playout"]`.
- [ ] Admin session → `playout` granted.
- [ ] `?topics=playuot` → 400; missing `topics` → 400.
- [ ] Published bus event reaches a granted subscriber as `event: <type>` + JSON data.
- [ ] Heartbeat comment written after quiet interval (DI'd short interval in test).
- [ ] Connection closes past DI'd deadline and past session expiry.
- [ ] 1001st connection → 503 (DI'd low cap in test).

### Unit 4: Wiring (mount + shutdown)
**Files**: `apps/api/src/app.ts`, `apps/api/src/index.ts`
**Story**: `bold-event-spine-sse-endpoint-route`

- `app.route("/api/sse", sseRoutes)` — static import (always-on, like streaming).
- Shutdown: `eventBus.closeAll()` immediately after `server.close()`, **before**
  `stopBoss()` — the current shutdown never awaits `server.close()`, so the value is a
  clean FIN to clients (instant reconnect instead of TCP error detection), not
  unblocking close.

**Acceptance Criteria**:
- [ ] `/api/sse` mounted; no rate-limit interference from auth limiters.
- [ ] Shutdown path calls `closeAll()` in order; existing shutdown tests still green.

### Unit 5: Proof publisher — `channel.live-state-changed`
**File**: `apps/api/src/services/channels.ts`
**Story**: `bold-event-spine-sse-endpoint-proof`

- `eventBus.publish({ type: "channel.live-state-changed", channelId, live: true })` at
  the end of `createLiveChannel`; `live: false` in `deactivateLiveChannel`.
- Duplicate `live: true` on SRS `on_publish` retries (reactivation path) is **fine by
  design** — notification semantics; documented so it isn't reported as a bug.
- ⚠ Coordination: `services/channels.ts` sits on `unified-channel-model` epic churn
  (Lane 1) and now owns `SNC_TV_BROADCAST` from the landed dedup story. Re-check the
  seam immediately before implementing this story.

**Acceptance Criteria**:
- [ ] Unit test: spied bus receives the event on create/deactivate.
- [ ] End-to-end (dev env): a Bun `fetch` script (NOT curl — denied command) connected
  through Caddy `:3080` receives `spine.connected`, heartbeats, and the live-state
  event when a stream starts/stops; events arrive unbuffered (proves Caddy auto-flush).
- [ ] Held-open connection survives > 5 minutes through Caddy (empirically confirms
  @hono/node-server timeout defaults don't apply to streaming responses).

---

## Implementation Order
1. `bold-event-spine-sse-endpoint-types-bus` (Units 1–2)
2. `bold-event-spine-sse-endpoint-route` (Units 3–4)
3. `bold-event-spine-sse-endpoint-proof` (Unit 5)

## Testing
- **Bus unit tests** `apps/api/tests/services/event-bus.test.ts` — grant filtering,
  scope filter, coalescing, timeout turns, closeAll, post-close publish.
- **Route tests** `apps/api/tests/routes/sse.routes.test.ts` — via `app.request()`
  reading the response stream with DI'd intervals; auth matrix per Unit 3 criteria.
- **Integration** — Bun fetch script through Caddy (Unit 5); manual stream start/stop
  via dev helpers (`scripts/dev/test-live-fallback.sh` family).

## Risks
- **Proxy buffering is the load-bearing assumption**: Caddy auto-flushes
  `text/event-stream` — verified only by the through-Caddy integration step, not unit
  tests. If it fails, `no-transform` + explicit flush investigation is the fallback.
- **Abort propagation** (@hono/node-server ^1.19): not trusted; write-failure-as-death
  covers it, worst-case zombie lifetime ≈ one heartbeat interval.
- **Dev connection budget**: HTTP/1.1 in dev means ~6 connections per origin across all
  tabs; one SSE per tab starves API requests at ~5 open tabs. Known dev-only limitation
  (prod is h2). The client-subscriptions work (absorbed into the redesign epics) should
  consider BroadcastChannel/SharedWorker leader election — one connection per browser.
- **`services/channels.ts` churn** — see Unit 5 coordination note.

## Implementation summary (2026-06-13)

All three child stories implemented (one bundle agent, sequential, one commit each):
`types-bus` (done — reviewed), `route` (done — reviewed), `proof` (review). Orchestrator
wave verification caught and fixed a lifecycle bug beyond the literal ACs — closed
subscriptions busy-spun heartbeats and shutdown `closeAll()` never ended live streams;
`Subscription.isClosed()` added to the contract, loop breaks on it (commit `fix(sse)`).
Verification: 33 SSE-scoped tests green; full `@snc/api` unit suite (1543) green;
`@snc/shared` + `@snc/web` green; API build passes. Empirical: 5.5-minute held-open
connection through Caddy with 25s heartbeats throughout (Caddy auto-flush + node-server
streaming defaults confirmed). Honest residue: the live-state event has not been
observed end-to-end on a real stream start/stop (needs a creator going live against dev
SRS); publish seams are unit-tested and the wire path is route-tested.

Deviations: `Cache-Control` is `no-cache` (Hono `streamSSE` overwrites any pre-set
value; semantically fine for SSE) rather than the designed `no-store, no-transform`.

## Other agent review
Fresh-context advisory pass (same-model fallback per project review policy) accepted:
route rename off `/api/events` (calendar collision), notification-hint semantics (kills
connect race), coalescing over close-on-overflow (reconnect storms), no `id:` field
(PM2-restart epoch regression), session-expiry lifetime bound, jittered lifetime +
`retry:` (herd damping), registry-level scope-filter fence for `content`, 400 on unknown
topics, shutdown-ordering correction (closeAll for clean FIN, not to unblock
`server.close()` — which is never awaited), write-failure-as-authoritative cleanup, Bun
fetch over denied `curl`, >5min held-open verification. Rejected: none material.

## Review (2026-06-13)
**Verdict**: Approve (deep lane, fresh-context sub-agent — not cross-model)
**Blockers**: none
**Important** (all dispositioned at review): (1) real-bus→route composed test never
exercised (route tests use a mock bus) → carry-over line added to
bold-event-spine-publishers; (2) live-state e2e residue would archive into a bodyless
stub → same carry-over; (3) streamSSE drops the designed no-transform header (only
no-cache survives) — latent silent-buffering risk if anyone adds Caddy encode → guard
comment added to deploy/Caddyfile.prod.example.
**Nits** (accepted): deadline debug log fires on every loop exit; query double-cast;
content-topic scopeFilter fence is prose-only; smoke script comment says 6min vs 5.5;
single-consumer next() constraint implicit; rootLogger loses request correlation.
**Notes**: auth enforcement is structural (granted-set subscription + per-event
re-check); snapshot-on-connect with no id: field, rationale recorded; 8faac57
regression tests are self-enforcing; suite 1563/1563 at HEAD. Unblocks publishers
(pending its lifecycle-playout-queue dep).
