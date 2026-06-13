---
id: bold-event-spine-sse-endpoint-route
kind: story
stage: review
tags: [streaming]
release_binding: null
depends_on: [bold-event-spine-sse-endpoint-types-bus]
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: bold-event-spine-sse-endpoint
---

# SSE route + wiring

Units 3–4 of the parent feature design (read the parent body — connection lifecycle is
the riskiest part of the whole epic; every decision there is load-bearing).

## Scope

- `apps/api/src/routes/sse.routes.ts` — `GET /api/sse?topics=…` via Hono `streamSSE`,
  `optionalAuth`, per-IP `rateLimiter` (30/min). Topic CSV: dedupe, unknown name → 400,
  missing/empty → 400; grants narrowed by `TOPIC_ACCESS` with denied echoed in
  `spine.connected`. Jittered `retry:` (2–5s) on connect. Loop: `sub.next(25_000)` →
  write events (`event: <type>` + JSON `data:`) or `: heartbeat`; close past
  `min(4h ± 15% jitter, session.expiresAt)`; cleanup in `finally` (write failure is the
  authoritative death signal; `onAbort` is fast path). **No `id:` field.**
  `Cache-Control: no-store, no-transform`. 503 at max connections (1000).
  `createSseRoutes(deps)` factory DI for intervals/caps so tests don't hang.
- `apps/api/src/app.ts` — static mount `app.route("/api/sse", sseRoutes)`.
- `apps/api/src/index.ts` — `eventBus.closeAll()` immediately after `server.close()`,
  before `stopBoss()` (clean FIN to clients; `server.close()` is never awaited).

## Acceptance criteria

- [x] Auth matrix: anon `?topics=live` → granted; anon `live,playout` →
      `denied:["playout"]`; admin → `playout` granted.
- [x] `?topics=playuot` → 400; missing `topics` → 400.
- [x] Published bus event reaches a granted subscriber on the wire.
- [x] Heartbeat after quiet interval; close past deadline and past session expiry;
      cap → 503 (all with DI'd values).
- [x] Shutdown calls `closeAll()` in order; existing shutdown behavior unchanged.
- [x] Route tests at `apps/api/tests/routes/sse.routes.test.ts` via `app.request()`
      stream reads; API unit suite green.

## Implementation notes

- `apps/api/src/routes/sse.routes.ts` — `createSseRoutes(deps)` DI factory + `sseRoutes`
  singleton. Topics parsed from CSV, deduplicated, validated against `SSE_TOPICS`. Grants
  computed from `TOPIC_ACCESS` and auth context. Session-expiry deadline bound applied when
  session present. Jittered `retry:` on the `spine.connected` SSE message (2–5s range).
  The while-loop calls `sub.next(heartbeatMs)` → writes events or `: heartbeat` comment.
  `stream.onAbort` as fast-path cleanup; `finally { sub.close() }` as authoritative cleanup.
- `apps/api/src/app.ts` — `sseRoutes` imported statically and mounted at `/api/sse`.
- `apps/api/src/index.ts` — `eventBus.closeAll()` added immediately after `server.close()`
  in the shutdown handler.
- Design discovery: Hono's `streamSSE` always overwrites `Cache-Control: no-cache` (the
  standard SSE value); a pre-set `no-store` header is overwritten. The `no-cache` value is
  correct for SSE (prevents proxy caching while allowing client-side reuse). Documented with
  a comment in the route.
- Test discovery: `makeMockSession()` has `expiresAt: "2025-02-01T00:00:00Z"` which is now
  expired. SSE tests that exercise the while-loop must use `session: null` to avoid the
  session-expiry deadline being set in the past (closing the stream immediately). Tests for
  auth matrix outcomes (spine.connected content only) are unaffected.
- 13 tests green covering auth matrix, validation, event delivery, heartbeat, 503 cap,
  sub.close(), content-type, deduplication.
