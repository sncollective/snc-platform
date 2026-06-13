---
id: bold-event-spine-sse-endpoint-route
kind: story
stage: implementing
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

- [ ] Auth matrix: anon `?topics=live` → granted; anon `live,playout` →
      `denied:["playout"]`; admin → `playout` granted.
- [ ] `?topics=playuot` → 400; missing `topics` → 400.
- [ ] Published bus event reaches a granted subscriber on the wire.
- [ ] Heartbeat after quiet interval; close past deadline and past session expiry;
      cap → 503 (all with DI'd values).
- [ ] Shutdown calls `closeAll()` in order; existing shutdown behavior unchanged.
- [ ] Route tests at `apps/api/tests/routes/sse.routes.test.ts` via `app.request()`
      stream reads; API unit suite green.
