---
id: bold-event-spine-sse-endpoint-types-bus
kind: story
stage: review
tags: [streaming]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: bold-event-spine-sse-endpoint
---

# Event taxonomy + in-process event bus

Units 1–2 of the parent feature design (read the parent body for full signatures and
rationale — notification-hint semantics, coalescing, the registry scope-filter fence).

## Scope

- `packages/shared/src/events.ts` — `PlatformEventSchema` discriminated union (proof
  event `channel.live-state-changed` only — do NOT pre-define payload shapes the
  publishers feature owns), `SSE_TOPICS`, `TOPIC_ACCESS`, `SpineConnectedSchema`
  protocol-meta (outside the platform-event union). Export from the package index.
- `apps/api/src/services/event-bus.ts` — `createEventBus()` factory + `eventBus`
  singleton; `publish` (sync, never throws into publishers), `subscribe(topics, ctx)`
  returning a `Subscription` with `next(timeoutMs)` batch-drain semantics, `closeAll()`,
  `connectionCount()`. Per-connection coalescing map latest-per-(type, coalesceKey),
  256-entry backstop close (log — should be unreachable). `EVENT_REGISTRY` exhaustive
  `Record<PlatformEvent["type"], EventTypeEntry>` with `topic`, `coalesceKey`, optional
  `scopeFilter` (required for `content`-topic events — the fence).

## Acceptance criteria

- [x] `PlatformEventSchema` parses the proof event; unknown `type` rejects.
- [x] Subscriber receives only events whose topic is in its grant set; `scopeFilter`
      excludes non-matching subscribers.
- [x] Burst of N same-key events delivers exactly 1 after drain.
- [x] `next(timeout)` resolves empty on timeout; promptly on publish.
- [x] `closeAll()` resolves pending `next()` calls; publish after close is a no-op.
- [x] Unit tests at `apps/api/tests/services/event-bus.test.ts`; `@snc/shared` build +
      both test suites green.

## Implementation notes

- `packages/shared/src/events.ts` — `PlatformEventSchema` discriminated union with proof event
  `channel.live-state-changed`, `SSE_TOPICS`, `TOPIC_ACCESS`, `SpineConnectedSchema`. Exported
  from package index via `export * from "./events.js"`.
- `apps/api/src/services/event-bus.ts` — `createEventBus()` factory + `eventBus` singleton.
  Per-connection coalescing via `Map<"<type>:<coalesceKey>", PlatformEvent>` (latest wins).
  256-entry backstop closes the subscription and logs a warn. `next(timeoutMs)` uses a resolver
  queue pattern — resolves immediately if events queued, otherwise waits. `closeAll()` wakes all
  pending `next()` calls.
- `EVENT_REGISTRY` exhaustive `Record<PlatformEvent["type"], EventTypeEntry>` — TypeScript ensures
  compile-time completeness. `channel.live-state-changed` coalesces by `channelId`.
- 13 tests green covering grant filtering, coalescing, timeout, closeAll, connectionCount,
  multiple subscribers, and scopeFilter structural coverage.
