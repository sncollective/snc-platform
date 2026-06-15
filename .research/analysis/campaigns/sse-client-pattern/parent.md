---
campaign: sse-client-pattern
provenance: agent-synthesis
updated: 2026-06-15
facets:
  - transport
  - react-integration
  - testing
verification_rigor: standard
---

# Browser SSE-consumer pattern for the spine — cross-synthesis

Lead synthesis across three facets (transport / react-integration / testing) settling the
client-side consumer pattern for the in-house SSE event spine, before the first browser
consumer is built. The settled recommendation is lifted to
`.research/analysis/positions/sse-client-pattern.md`; this parent carries the cross-facet
reconciliation and the contradiction ledger.

## The converged recommendation (one sentence per facet)

- **transport**: native `EventSource` fits the fixed spine contract (same-origin, GET,
  cookie auth) with no protocol gap; the no-`id:` contract makes every (re)connect a
  mandatory full state re-fetch, naturally bound to the `spine.connected` handshake
  [transport-facet].
- **react-integration**: one shared `<SpineProvider>` holding a single `EventSource` per
  tab, with `useSyncExternalStore`-bridged `useSpineTopic(topic)` hooks — not per-page glue
  [react-integration-facet].
- **testing**: a hand-rolled `FakeEventSource extends EventTarget` installed via
  `vi.stubGlobal` (jsdom has no `EventSource`), riding the platform's existing
  global-polyfill pattern — no new dependency [testing-facet].

These compose into a single coherent design: **a provider-owned native EventSource, one per
tab, that re-syncs authoritative REST state on every `spine.connected`, with consumers
subscribing to topic slices via `useSyncExternalStore`, tested against a fake EventSource
global.**

## Cross-facet reconciliations (the lead's job)

Three inter-facet seams the specialists flagged for the lead, resolved here:

### 1. Native-vs-fetch (transport) × maxConnections/multiplex (react-integration)
The transport facet correctly scoped the native-vs-fetch choice as a
*connection-budget-and-visibility* call rather than a wire-fit call, and deferred it here.
Resolution: **native EventSource**. The react-integration facet's single-connection-per-tab
design already satisfies the `maxConnections` cap *without* needing the fetch library's
visibility-driven hidden-tab close — and that fetch-library feature is actively
*counterproductive* here, because its advertised "reconnect with last event ID on refocus"
is nullified by the spine's no-`id:` contract (the refocus reconnect would be a full
re-sync anyway, per the transport facet's disconfirming analysis). So the fetch library's
one applicable differentiator buys nothing on this spine. Native wins on lower complexity +
zero dependency + no 2021-era maintenance risk.

### 2. Reconnect ownership (transport) × provider lifecycle (react-integration)
The transport facet established that the ~4h clean server close routes to the spec's
*reestablish* path — native auto-reconnect fires with no client code. Resolution: the
`<SpineProvider>`'s single lifecycle effect owns the `EventSource` and does NOT implement
its own reconnect/backoff timer for the lifetime-close or network-blip cases (the browser
handles them). The provider's only reconnect-adjacent responsibility is (a) re-running the
full state re-fetch on each `spine.connected`, and (b) detecting the *terminal* case
(`readyState === CLOSED` in the `error` handler — e.g. a session-expiry 401 on reconnect)
and routing to re-auth rather than spinning. This keeps the provider lifecycle simple and
means the testing facet's "fake timers only if the consumer owns a backoff timer" branch
resolves to **no fake timers needed** for the happy path.

### 3. EventSource-injection (testing) × provider shape (react-integration)
The testing facet named constructor-injection as the cleanest testable shape but correctly
deferred the call to react-integration. Resolution: the `<SpineProvider>` should accept an
**optional `eventSourceCtor` prop defaulting to the global `EventSource`**. Production uses
the default; tests pass a `FakeEventSource`. This gives the testing facet its preferred
injection path AND keeps `vi.stubGlobal` available as the fallback for any consumer that
can't be injected. Small surface, large testability payoff.

## Contradictions

No hard contradictions across the three facets — the recommendations compose without
conflict. Two **tensions** (incompatible-within-a-shared-frame was NOT met; these are
reconcilable scoping differences, recorded honestly rather than smoothed):

- **`tension` (react-integration ↔ transport, connection-keying):** `remix-utils`
  keys shared SSE connections per-URL [react-integration-facet], which would imply multiple
  connections if topics rode in the path. The spine instead carries topics in the query of a
  single URL with a partial-grant handshake, so the per-URL keying collapses to one
  connection per tab. Not a contradiction — the sources describe different connection
  models; the spine's model is the one that applies, and it happens to make the shared-
  connection design simpler.
- **`tension` (transport, native-vs-fetch):** the transport facet held the native-vs-fetch
  decision open pending the connection-budget analysis; reconciliation #1 above closes it to
  native. The brief's openness was correct scoping, not a disagreement.

## Disconfirming analysis (cross-synthesis level)

A salient disconfirming case for the converged recommendation would be: *"a single
shared connection is a single point of failure / contention vs. per-consumer connections."*
Checked against the facets: the `maxConnections` server cap makes per-consumer connections
the *worse* failure mode (a few open routes would exhaust a user's slot budget), and the
no-`id:` re-sync model means a dropped shared connection recovers cleanly (full re-fetch on
reconnect) rather than losing per-consumer state. The shared-connection design is more
robust under this spine's actual constraints, not less. No facet's evidence undermines the
converged shape.

## Acquisition candidates (consolidated)

Both enriching, non-blocking (see `acquisitions.md`): a maintained fetch-based SSE client as
a fresher alternative to `@microsoft/fetch-event-source` (only relevant if the native
decision is ever reversed); the MDN "Using server-sent events" full guide (the WHATWG spec
covered the normative content). Neither blocks the position.

## Citation note

Facet-level claims carry `[handle]{N}` citations in the specialist briefs
(`specialists/{transport,react-integration,testing}.md`), each chaining to a source-direct
attestation. This parent cites the *briefs* as lens (named `[facet]` inline, not as
`[handle]{N}` source citations — the lens-not-substrate guard), since its job is cross-facet
reconciliation, not new source engagement.
