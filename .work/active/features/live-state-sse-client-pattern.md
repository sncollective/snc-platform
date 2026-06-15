---
id: live-state-sse-client-pattern
kind: feature
stage: done
tags: [research, streaming]
research_refs: [sse-client-pattern]
release_binding: null
depends_on: []
gate_origin: null
research_dials:
  scope_authority: in-engagement-judgment
  verification_rigor: standard
  intent: adoption-decision
  output_kind: position
created: 2026-06-15
updated: 2026-06-15
parent: null
---

# Research: web SSE / EventSource client pattern for the spine

## Engagement

Ground the client-side consumer pattern for the platform's SSE event spine (`GET
/api/sse`) before `live-experience-redesign-live-state` (and siblings) build the first
web-side `EventSource` consumer. The output is a **settled position** the feature designs
on — not a shippable deliverable.

## Why this is a research input, not a design call

Several features consume the spine from the browser, and **none exists yet** — so the
primitive's shape has leverage and the decisions are non-obvious:

- `live-experience-redesign-live-state` (this engagement's commissioner) — live updates +
  takeover transitions + spine-fed viewer count.
- `live-experience-redesign-notify-me` — transitively (consumes live-state).
- `playout-admin-redesign-live-data` — admin live-data, also spine-dependent.

A wrong shape gets copied N times.

## Grounding constraints (the actual spine contract — read before researching)

- Endpoint `GET /api/sse?topics=live,playout,content`; `live` topic is **public**
  (anon viewers subscribe), `playout` admin, `content` authenticated (`events.ts`
  TOPIC_ACCESS).
- Sends a `spine.connected` handshake (`{granted, denied}`) then `{event: type, data:
  JSON}` frames + `: heartbeat` comments. Connection lifetime ~4h ±15% jitter, server
  closes; browser is told a 2–5s reconnect `retry`.
- **No `id:` field is ever sent** (`sse.routes.ts:98`) → there is **no `Last-Event-ID`
  resume**. Reconnection cannot replay missed events — the client must re-sync state on
  every (re)connect, which pairs with live-state's "re-fetch hint" model.
- Native `EventSource` auto-reconnects but only supports GET + same-origin + no custom
  headers; auth is cookie-based here (works for `EventSource`).

## Questions to settle (the position must answer)

1. **Reusable `useEventSource`/`useSpine` hook vs. page-local consumer** — given 3+
   consumers, where's the line between shared primitive and per-page glue?
2. **Reconnection model with no Last-Event-ID** — native `EventSource` auto-reconnect vs.
   a managed wrapper; how the client re-syncs authoritative state on every reconnect
   (full channel-list re-fetch on `spine.connected`?).
3. **React lifecycle** — StrictMode double-mount, effect cleanup, single shared
   connection vs. per-component connections (the spine has a `maxConnections` cap →
   prefer one multiplexed connection per tab?).
4. **Topic subscription ergonomics** — one connection with all needed topics vs. several;
   handling `denied` topics gracefully (anon gets `live`, not `content`).
5. **Library vs. hand-rolled** — native `EventSource`, a small fetch-stream wrapper, or a
   dependency? (Weigh against the platform's lean-deps posture.)
6. **Testing** — how to unit/integration test an `EventSource` consumer (mock pattern).

## Output

A `.research/analysis/positions/` position settling the above with a recommended
client-primitive shape + reconnection/lifecycle approach, grounded in the spine contract
above. `live-experience-redesign-live-state`'s client half designs on it; the
position's `research_origin` linkage flows back via the handoff gate.

## Note

This is the spine-consumer counterpart to the (server-side, already-shipped)
`bold-event-spine` work. The server publishes; this settles how the browser consumes.

## Engagement record (2026-06-15, agentic-research orchestrator)

**Dials** (read from this item, confirmed): scope_authority=in-engagement-judgment,
verification_rigor=standard, intent=adoption-decision, output_kind=position.

**Substrate-check**: no prior SSE/EventSource position in `.research/`; clean greenfield.
Adjacent (non-overlapping): `briefs/simulcast-chat-bridge.md` (realtime chat, not the
client-consumer pattern).

**Decomposition** (emergent, `in-engagement-judgment`; chosen over 2 alternatives):
3 facets by technology layer —
1. **transport** — native `EventSource` vs fetch-stream vs library; reconnection without
   `Last-Event-ID`; the spine's connection-lifetime/retry contract.
2. **react-integration** — hook-vs-page-local (synthesis-level, owned here); StrictMode
   double-mount; single multiplexed connection per tab; topic subscription + denied-topic
   handling.
3. **testing** — mocking/driving an `EventSource` consumer in the platform's Vitest setup.
Rejected: one-facet-per-seed-question (over-decomposed — questions 1/2/3 overlap heavily
→ redundant fetches); decision-vs-mechanism 2-facet (bundles testing awkwardly with
architecture). Self-flag: "hook-vs-local" is a synthesis-level architecture call spanning
transport+react — assigned to react-integration with a note; the lead resolves it at
cross-synthesis.

Output → `.research/analysis/positions/sse-client-pattern.md` (a campaign bundle under
`.research/analysis/campaigns/sse-client-pattern/` feeds it).

**Completion (2026-06-15)** — engagement done, closed to `done` (`research_completion:
close-to-done`; verification ran inline).
- **Fan-out**: 3 parallel research-specialists (transport / react-integration / testing),
  18 source-direct attestations (WHATWG SSE spec, MDN, official React docs,
  jsdom/Vitest/RTL docs, named community sources).
- **Verification (standard rigor)**: lint ✓ (all citation chains resolve; the only flags
  are `[low] unreachable-source` URL-liveness false-negatives on two real pages) →
  adversarial-read ✓ **APPROVED** (fresh-context, zero blocking findings; walked the
  load-bearing WHATWG transport claims back to source) → spot-check ✓ (confirmed the
  clean-close→reestablish bridge is the spec's own logic, not an over-read).
- **Output position**: `.research/analysis/positions/sse-client-pattern.md` — settles:
  native `EventSource` (no dep); one `<SpineProvider>` per tab via `useSyncExternalStore`;
  full REST re-sync on every `spine.connected` (no-`id:` → no replay); native auto-reconnect
  on the clean 4h close (provider owns no backoff timer, only terminal-`CLOSED` re-auth
  routing); inject `eventSourceCtor` + a hand-rolled `FakeEventSource` for tests (jsdom has
  no EventSource).
- **Consumes**: `live-experience-redesign-live-state`'s client half designs on this;
  siblings `notify-me` + `playout-admin-redesign-live-data` reuse the `<SpineProvider>`.
- **Acquisitions**: 2 enriching candidates (non-blocking), in the campaign manifest;
  operator-confirmed promotion only.
