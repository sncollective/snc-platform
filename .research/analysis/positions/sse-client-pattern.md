---
provenance: agent-synthesis
updated: 2026-06-15
campaign: sse-client-pattern
verification_rigor: standard
revisit_if:
  - the spine starts emitting `id:` fields (re-enables Last-Event-ID resume; changes the re-sync-on-reconnect obligation)
  - the SSE endpoint moves cross-origin (forces withCredentials + CORS-credentials story)
  - a POST body / custom request header / bearer-token-per-connection becomes required (flips native→fetch-based decisively)
  - event volume per tab proves high enough that useSyncExternalStore re-render cost matters (re-weigh the memoized-context fallback)
---

# Position: browser SSE-consumer pattern for the spine

**Settles** the client-side consumer architecture for the in-house SSE event spine
(`GET /api/sse`), commissioned by `live-state-sse-client-pattern` before the first browser
consumer is built. Three consumers are planned (`live-experience-redesign-live-state`,
`-notify-me`, `playout-admin-redesign-live-data`), so the primitive's shape has leverage.

Derivation: `.research/analysis/campaigns/sse-client-pattern/` (3-facet campaign,
`standard` rigor — lint + adversarial-read + spot-check). All claims chain to source-direct
attestations of the WHATWG SSE spec, MDN, official React docs, jsdom/Vitest/RTL docs, and
named community sources.

## The position

Build **one shared `<SpineProvider>` holding a single native `EventSource` per browser tab**,
exposing topic-scoped subscriptions through `useSyncExternalStore`, and treating the SSE
stream as a **push/cache-invalidation channel over REST-of-record** (not a sole source of
truth). Concretely:

### 1. Transport: native `EventSource` (not a fetch-based client, no dependency)
The spine is same-origin, GET, cookie-authenticated — exactly native `EventSource`'s
envelope. Same-origin cookies are sent automatically (`withCredentials` governs only
*cross-origin* CORS). Every limitation `@microsoft/fetch-event-source` exists to lift
(POST/body/custom-headers/retry-control) is unused here, and its one applicable feature
(resume-on-refocus via Last-Event-ID) is *nullified* by the spine's no-`id:` contract. Native
is the lower-complexity, zero-dependency fit.

### 2. Reconnection: rely on native auto-reconnect; re-sync state on every connect
The spine sends no `id:`, so there is no event replay — a reconnect can miss events. **Every
`spine.connected` handshake triggers a full re-fetch of authoritative REST state** for the
subscribed topics; subsequent SSE events apply deltas on top. The ~4h server close is a
*clean* end of an HTTP-200 stream → the browser auto-reconnects with **no client code** (only
non-200 / wrong-content-type / explicit close are terminal). The provider does **not** own a
backoff timer; it only (a) re-syncs on `spine.connected`, and (b) detects the terminal case
(`readyState === CLOSED` in `error`, e.g. session-expiry 401 on reconnect) and routes to
re-auth instead of spinning. The server's `retry:` hint sets the reconnect interval.

### 3. React shape: one provider, `useSyncExternalStore` bridge, topic hooks
A `<SpineProvider>` opens one `EventSource` (respecting the server `maxConnections` cap — one
per tab, not one per component). Consumers subscribe via `useSpineTopic(topic)` bridged with
`useSyncExternalStore` (the correct React primitive for an external mutable event source — it
gives the concurrent-rendering tearing guarantee plain `useEffect`+`useState` lacks). The
same `eventSource.close()` cleanup that respects the cap also makes the provider
StrictMode-correct (the dev setup→cleanup→setup cycle reuses one connection) — do NOT use the
ref-flag suppression anti-pattern React docs forbid. The `{granted, denied}` handshake is
stored in the provider; `useSpineTopic` returns a typed `denied` status for denied topics
(anon gets `live`, is denied `content`) so consumers render an affordance, never opening a
second connection to retry.

### 4. Testability: inject the constructor, default to global
The `<SpineProvider>` accepts an optional `eventSourceCtor` prop defaulting to the global
`EventSource`. jsdom does **not** implement `EventSource`, so tests pass a hand-rolled
`FakeEventSource extends EventTarget` (a small test double — comparable in size to the
existing `ResizeObserver` polyfill in `tests/setup.ts`) — either via the inject prop or
`vi.stubGlobal("EventSource", FakeEventSource)`, which rides the platform's existing
`tests/setup.ts` global-polyfill pattern (`ResizeObserver` etc.) and `unstubGlobals`/
`restoreMocks` config. No new dependency. Drive `open`/`message`/`error` events from test
code wrapped in `act(...)` (events originate outside React's system). Fake timers are needed
only if a consumer owns its own backoff timer — which this design avoids — so the happy path
needs none. `eventsourcemock` was assessed and **not** recommended (unmaintained;
EventEmitter-not-EventTarget fidelity gap).

## What this unblocks

`live-experience-redesign-live-state`'s **client half** designs directly on §1–4. Siblings
`notify-me` and `playout-admin-redesign-live-data` reuse the same `<SpineProvider>` —
building it once here is the leverage. The server half of `live-state` (derived `liveState`
field + LIVE-badge fix) is independent of this position and proceeds in parallel.

## Confidence + boundaries

`standard` rigor: the transport claims are spec-grounded (WHATWG, the normative authority);
the React-shape claims are official-React-docs-grounded with community corroboration on the
EventSource-in-React idiom; the testing claims are tool-doc-grounded plus verified against the
platform's actual vitest config. The `useSyncExternalStore`-vs-memoized-context choice (§3) is
the softest point — if per-tab event volume proves high, re-weigh (see `revisit_if`). The
position settles *architecture*; exact prop/type signatures are the feature's design-time
call.
