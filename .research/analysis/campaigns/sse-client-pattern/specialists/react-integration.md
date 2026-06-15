---
provenance: agent-synthesis
updated: 2026-06-15
campaign: sse-client-pattern
facet: react-integration
status: specialist-brief
---

# SSE client pattern — React integration facet

How a React 19 / TanStack Start app structures a browser SSE consumer against an in-house SSE
spine: `GET /api/sse?topics=live,playout,content` (cookie-auth, same-origin), a
`spine.connected` handshake (`{granted, denied}`) then named events, NO `Last-Event-ID` resume,
server closes at ~4h, and a server `maxConnections` cap that makes ONE multiplexed connection
per tab the target. This facet settles React-side structure and makes the architecture call
(reusable hook + provider vs page-local glue). Transport-wire mechanics and testing are sibling
facets; the lead reconciles this recommendation against them.

## Recommendation (the architecture call)

**Build one shared connection primitive — a context provider holding a single `EventSource`
per tab, with components subscribing to topic-filtered slices via a hook — not per-page glue.**
Three forces converge on this, each source-grounded below:

1. **The server cap forces one connection per tab.** The spine declares a `maxConnections`
   cap and the seed states the preference for ONE multiplexed connection carrying all needed
   topics. Per-page or per-component `EventSource` instances multiply connections per tab and
   race the cap. A single connection shared across the tree is exactly the "provide a single
   shared resource to a subtree" use case React context is for [react-docs-usecontext]{1}. An
   established community implementation (remix-utils' `useEventSource`) reaches for the same
   structure — a reference-counted connection map held in an `EventSourceProvider` context so
   "multiple hook instances with identical URLs/options reuse the single EventSource"
   [remix-utils-use-event-source]{1}. A practical SSE-in-React guide independently lands on the
   same rule: "Use a single connection with event routing instead of multiple connections"
   [oneuptime-sse-react-guide]{1}.

2. **3+ planned consumers make a shared primitive idiomatic, not premature.** With a live page,
   a notify-me flow, and an admin live-data page all needing spine data, the shared
   resource is "passed deeply into the tree" without prop drilling — the context use case
   [react-docs-usecontext]{1}. Per-page glue would re-derive connection lifecycle, handshake
   parsing, and named-event wiring three times.

3. **`useSyncExternalStore` is the correct React bridge for the external mutable source.** The
   spine's connection state and last-event-per-topic live outside React; an `EventSource` is a
   "custom event system React doesn't control" — precisely what `useSyncExternalStore` is for
   [epicreact-usesyncexternalstore-demystified]{1}. It is "the correct, robust solution" for
   "syncing with state outside React" [epicreact-usesyncexternalstore-demystified]{1}, and the
   official docs document the exact bridge: `subscribe(callback)` attaches a listener and
   returns an unsubscribe; `getSnapshot()` returns the current value
   [react-docs-usesyncexternalstore]{1}. Under React 19 concurrent rendering it also prevents
   tearing — "if an external store changes while React is in the middle of rendering... different
   components might read different versions" [epicreact-usesyncexternalstore-demystified]{1} — a
   guarantee plain `useEffect`+`useState` lacks.

### Recommended shape

- **`<SpineProvider>`** near the app root (under TanStack Start's root route): owns the single
  `EventSource`, opens it lazily when the first consumer mounts, holds a small in-memory store
  (connection status; `{granted, denied}` from the handshake; last event payload per topic).
  The provider value is a stable object of `{ subscribe, getStatus, getGrants, getTopicSnapshot }`
  wrapped in `useMemo` so provider re-renders don't cascade to every consumer
  [react-docs-usecontext]{1}.
- **`useSpineConnection()`** — reads connection status + `{granted, denied}` via
  `useSyncExternalStore` over the provider store.
- **`useSpineTopic(topic)`** — reads the latest event for one topic via `useSyncExternalStore`,
  filtered to that topic's slice. Components subscribe to the slice they need, not the whole
  connection.

The connection lifecycle (open/close) lives in **one** `useEffect` inside the provider, with a
cleanup that closes the `EventSource` — the chat-server pattern from the official docs:
`connection.connect()` on setup, `connection.disconnect()` (here `eventSource.close()`) on
cleanup [react-docs-useeffect]{1}[oneuptime-sse-react-guide]{1}.

### `subscribe` / `getSnapshot` discipline (the load-bearing details)

- **Declare `subscribe` so it is referentially stable** — the provider's `subscribe` registers
  a store listener and returns an unsubscribe; it must not be re-created per render or React
  re-subscribes on every render. The docs: "If a different `subscribe` function is passed during
  a re-render, React will re-subscribe... You can prevent this by declaring `subscribe` outside
  the component" (or `useCallback`) [react-docs-usesyncexternalstore]{1}.
- **`getSnapshot` must return a cached value while unchanged** — "While the store has not
  changed, repeated calls to `getSnapshot` must return the same value" and "must be immutable"
  [react-docs-usesyncexternalstore]{1}. For a per-topic snapshot, cache the last event object
  per topic in the store and return that same reference until a new event for that topic
  arrives; returning a freshly-built object every call triggers the "result of `getSnapshot`
  should be cached" error and needless re-renders [react-docs-usesyncexternalstore]{1}
  [epicreact-usesyncexternalstore-demystified]{1}.
- **SSR / TanStack Start:** TanStack Start server-renders. `EventSource` is browser-only, so
  provide a `getServerSnapshot` returning a constant initial value ("disconnected", empty
  grants) — omitting it "will throw an error" on the server [react-docs-usesyncexternalstore]{1}.
  Open the connection only client-side (inside the effect, which does not run during SSR). Keep
  the server snapshot identical between server and client to avoid hydration mismatch
  [react-docs-usesyncexternalstore]{1}.

## Question 2 — StrictMode double-invoke (dev) and correct setup/cleanup

React 19 StrictMode runs "one extra setup+cleanup cycle in development for every Effect"
[react-docs-strictmode]{1} — the dev sequence is setup → cleanup → setup
[react-docs-useeffect]{1}. For a connection-opening effect this is a deliberate stress-test: an
effect that opens an `EventSource` with no cleanup "creates an extra connection but doesn't
destroy it" and "the number of active connections jumps to 2" [react-docs-strictmode]{1}.

**The correct response is proper cleanup, NOT suppressing the second run.** The official Learn
guidance is explicit: "Don't use refs to prevent Effects from firing" — gating connect behind a
`useRef` flag "doesn't fix the bug" because on navigate-away the connection still isn't closed,
and connections "keep piling up" [react-docs-synchronizing-with-effects]{1}. The fix is the
cleanup that closes the connection: with cleanup, dev shows Connecting → Disconnected →
Connecting, which "is the correct behavior in development"
[react-docs-synchronizing-with-effects]{1}.

**Concretely for the spine provider:** the provider's single connection-lifecycle effect opens
the `EventSource` on setup and `eventSource.close()` on cleanup
[react-docs-synchronizing-with-effects]{1}[oneuptime-sse-react-guide]{1}. Under StrictMode this
opens-then-closes-then-reopens once in dev — one connection at a time, matching production's
single open. This makes the cap-respecting design and the StrictMode-correctness design the same
design: the cleanup that satisfies StrictMode is the cleanup that keeps the tab at one
connection. (Note for the lead: since the spine has NO `Last-Event-ID` resume, the dev
close→reopen drops any in-flight buffered events on that mount — acceptable in dev, but the
testing facet should confirm the reopen re-runs the handshake cleanly. The reconnect/backoff
mechanics on the ~4h server close and on error are transport-facet territory.)

## Question 4 — topic subscription + denied-topic handling

The `spine.connected` handshake returns `{granted, denied}` (anon gets `live`, denied
`content`). Surface this cleanly by storing the parsed handshake result in the provider store
and exposing it through `useSpineConnection()`:

- The provider's named-event listener for `spine.connected` writes `{granted, denied}` into the
  store (one `setState`/store-write), the same way community implementations store the latest
  named-event payload in state and notify subscribers
  [remix-utils-use-event-source]{1}[oneuptime-sse-react-guide]{1}.
- `useSpineTopic(topic)` checks grants: if `topic` is in `denied`, the hook returns a typed
  `denied` status instead of a live snapshot, so a component (e.g. the admin live-data page) can
  render an "upgrade / sign in to see content" affordance rather than silently showing nothing.
  Topics in `granted` return live snapshots. This keeps denied-topic handling declarative and
  co-located with the consumer, not scattered across error handlers.
- Because the request asks for `topics=live,playout,content` up front and the server replies with
  the partial grant, the client never opens a second connection to retry a denied topic — it
  reflects the grant in UI. This preserves the one-connection-per-tab invariant under the cap.

A caveat the lead should weigh: remix-utils keys its shared connection on URL+credentials, so
distinct topic-sets would be distinct connections under that library's model
[remix-utils-use-event-source]{1}. The spine's design (one URL, all topics as a query param,
server-side partial grant) deliberately collapses to a single key per tab — so the multiplexing
is "one connection, many topic-filtered subscribers," not "one connection per topic-set." Build
the provider around a single fixed topic-set request, not remix-utils' per-URL map, unless a
consumer genuinely needs a disjoint topic-set (none of the three planned consumers do).

## Disconfirming analysis

- **Could plain `useEffect`+`useState` per page be enough (no provider, no
  `useSyncExternalStore`)?** It works for a single consumer and the official docs show the bare
  `EventSource`-in-`useEffect` pattern [oneuptime-sse-react-guide]{1}. But it fails this facet's
  two hard constraints: (a) 3+ consumers each opening their own connection breaches the
  `maxConnections` cap, and (b) plain `useState` gives no tearing guarantee under React 19
  concurrent rendering, which `useSyncExternalStore` is specifically built to provide
  [epicreact-usesyncexternalstore-demystified]{1}. So the simpler pattern is disconfirmed *for
  this spine's constraints*, not in general.
- **Is `useSyncExternalStore` overkill vs. the provider just holding `useState` and passing it
  down?** A provider-with-`useState` would re-render the whole subtree on every event unless
  carefully sliced; `useSyncExternalStore` lets each `useSpineTopic` subscribe to only its
  topic's slice and re-render only when *that* slice changes (Object.is on the cached snapshot)
  [react-docs-usesyncexternalstore]{1}. With a live page receiving frequent `live`/`playout`
  events, narrowing re-renders is load-bearing, so the extra hook earns its place. If event
  volume turns out low and consumers few, a memoized-context-value approach
  [react-docs-usecontext]{1} would be adequate — flagged as the lighter fallback.
- **Did I find a source recommending per-page consumers for multi-consumer apps?** No. Every
  source touching multi-consumer / app-wide SSE reached for a shared connection +
  provider/hook ([remix-utils-use-event-source]{1}, [oneuptime-sse-react-guide]{1}), and the
  React docs frame context + `useSyncExternalStore` as the tools for exactly this
  ([react-docs-usecontext]{1}, [react-docs-usesyncexternalstore]{1}). The convergence is the
  recommendation's main support; I actively looked for a dissenting "keep it page-local" source
  and did not find a reputable one for the 3+-consumer case.

## Contradictions

No direct source contradiction surfaced. The one tension is **scoping**, not disagreement:
remix-utils keys shared connections per-URL (so different topic-sets ⇒ different connections)
[remix-utils-use-event-source]{1}, whereas the spine's single-URL-partial-grant design wants one
connection regardless of which topics a given consumer reads. These are compatible — the spine's
design is a deliberate simplification of the general multiplexing problem, and the
recommendation adopts the single-fixed-key form rather than remix-utils' per-URL map.

## Revisit if

- A consumer genuinely needs a *disjoint* topic-set from the others (would reopen the
  one-connection-per-tab assumption and pull remix-utils' per-key map back into scope).
- The transport facet settles a reconnect/backoff design that needs to live in the provider's
  lifecycle effect — fold it into the single connection effect rather than per-consumer.
- Event volume proves low enough that the `useSyncExternalStore` slice-subscription benefit
  doesn't pay for itself — drop to a memoized-context-value provider [react-docs-usecontext]{1}.
- React ships guidance changes for SSE/EventSource specifically, or TanStack Start adds a
  first-class streaming-subscription primitive that supersedes a hand-rolled provider.
- The testing facet finds the StrictMode close→reopen interacts badly with the no-resume
  handshake in a way that needs a client-side guard.
