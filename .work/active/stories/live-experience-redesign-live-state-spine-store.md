---
id: live-experience-redesign-live-state-spine-store
kind: story
stage: review
tags: [streaming]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-15
updated: 2026-06-15
parent: live-experience-redesign-live-state
---

# Reusable SSE spine consumer: store + provider + topic hooks

The reusable client-side SSE primitive, built on
`.research/analysis/positions/sse-client-pattern.md`. This is the part siblings
(`notify-me`, `playout-admin-redesign-live-data`) reuse — keep it clean of any
live-page specifics.

## Units (from the parent design — C1 + C2)

- **`apps/web/src/contexts/spine-store.ts`** (C1) — framework-agnostic core: one native
  `EventSource` per store, the `useSyncExternalStore` contract (`subscribe`/`getSnapshot`),
  per-topic dispatch (`onTopic`), `spine.connected` handshake parsing into a
  `{status, granted, denied}` snapshot, `error`-handler `readyState` triage
  (CONNECTING=transient/no-op, CLOSED=terminal/stop), `close()`. NO backoff timer — native
  auto-reconnect owns lifetime-close + blips. Injectable `eventSourceCtor` (default global)
  for tests.
- **`apps/web/src/contexts/spine-context.tsx`** (C2) — `SpineProvider` (one store in a ref,
  closed on unmount; StrictMode-correct via the close()/recreate cycle, NO ref-flag
  suppression), `useSpineStatus()` (status via `useSyncExternalStore`), `useSpineTopic(topic,
  onEvent)` (registers via `store.onTopic`, latest-handler ref like `usePolling`'s fetcherRef;
  returns `{denied}` for denied topics).

## Tests (C4, the infra portion)

`apps/web/tests/unit/contexts/spine-context.test.tsx` + a `FakeEventSource extends EventTarget`
double at `apps/web/tests/helpers/fake-event-source.ts`. Inject via the `eventSourceCtor`
prop; drive `spine.connected` / a named event / `error` (CONNECTING vs CLOSED) via `act(...)`;
assert snapshots + `onTopic` firing. No new dependency; rides the `tests/setup.ts` pattern.

## Acceptance
- [ ] `SpineProvider topics={["live"]}` opens exactly one EventSource; closes on unmount.
- [ ] `spine.connected` populates granted/denied; `useSpineStatus` reflects open/denied.
- [ ] `useSpineTopic("live", h)` calls `h` on each `channel.live-state-changed`.
- [ ] `error` with readyState CONNECTING → status connecting, no teardown; CLOSED → status
      closed, stops.
- [ ] No SSR open attempt (EventSource is client-only; provider effect is client-side).
- [ ] web unit suite green at baseline; tsc clean.

## Implementation (2026-06-15)
- `spine-store.ts`: `createSpineStore(topics, eventSourceCtor=EventSource)` — one
  EventSource, `subscribe`/`getSnapshot` (useSyncExternalStore contract), `onTopic`
  dispatch via an EVENT_TOPIC map, `spine.connected` handshake parse, `error`
  readyState triage (CLOSED→closed, else→connecting), `close()`. No backoff timer.
- `spine-context.tsx`: `SpineProvider` (one store in a ref, client-only create, close
  on unmount → StrictMode-correct), `useSpineStatus` (useSyncExternalStore bridge),
  `useSpineTopic` (onTopic via latest-handler ref; returns `{denied}`).
- Tests: `FakeEventSource extends EventTarget` (tests/helpers) + 7 spine-context tests
  (injected ctor): one-connection, handshake grants, denied, topic firing, topic
  isolation, error triage, unmount-close. Also a no-op `EventSource` stub in
  tests/setup.ts so un-injected consumers mount in jsdom.
- Verified: web tsc clean; 7/7 spine tests; live stack `/api/sse?topics=live` → 200
  text/event-stream with `spine.connected {granted:[live]}`.
