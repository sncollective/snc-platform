---
facet: transport
campaign: sse-client-pattern
provenance: agent-synthesis
updated: 2026-06-15
substrate_confidence: source-direct
attestations:
  - whatwg-sse-eventsource
  - mdn-eventsource
  - microsoft-fetch-event-source
  - mdn-fetch-credentials
---

# Transport facet — browser SSE-consumer wire mechanics

Scope: the wire/protocol layer of the in-house SSE spine consumer — which client
primitive to open the stream with, and how reconnection behaves given the spine's
fixed no-`id:` / no-resume contract. React integration and testing are sibling
facets and are out of scope here.

## Spine constraints this facet designs around (fixed)

- `GET /api/sse?topics=live,playout,content`, same-origin, cookie auth.
- Handshake `spine.connected` event, then named `{event, data:JSON}` events +
  `: heartbeat` comment lines.
- **No `id:` field is ever sent → no `Last-Event-ID` resume.** Load-bearing.
- Server closes at ~4h (±15% jitter); sends a 2–5s `retry:` hint.
- A server `maxConnections` cap favors one multiplexed connection per tab.

---

## Q1 — Native `EventSource` vs a fetch-based client

### What each primitive is

Native `EventSource` is GET-only, opens in same-origin or CORS mode, sends no custom
request headers, and auto-reconnects natively. Its constructor takes a URL plus an
`EventSourceInit` whose only member is `withCredentials`; the request is issued with
cache mode `no-store` and is validated as HTTP 200 + `Content-Type:
text/event-stream` or it fails [whatwg-sse-eventsource]{1}. MDN states the
constructor "Creates a new `EventSource` to handle receiving server-sent events from
a specified URL, optionally in credentials mode," with `withCredentials` defaulting
to `false` [mdn-eventsource]{2}.

The fetch-based alternative `@microsoft/fetch-event-source` reimplements the SSE
client over `fetch()` to lift four `EventSource` limitations its README names
verbatim: no request body, "You cannot pass in custom request headers," "You can
only make GET requests - there is no way to specify another method," and "you don't
have any control over the retry strategy: the browser will silently retry for you a
few times and then stop" [microsoft-fetch-event-source]{3}.

### Cookie-auth + same-origin + GET fit

The spine is **same-origin, GET, cookie-authenticated** — which is exactly the
envelope native `EventSource` was designed for. A same-origin `EventSource` request
carries the session cookie without any option set (`withCredentials` governs
*cross-origin* CORS credentials, which the spine does not need)
[mdn-eventsource]{2}. None of the four `EventSource` limitations the fetch library
exists to solve [microsoft-fetch-event-source]{3} are present in the spine contract:

- no request body needed (topics ride in the query string, well under the URL-length
  concern the README raises);
- no custom request headers needed (cookie auth rides the standard `Cookie` header,
  which the browser attaches automatically — it is not a "custom" header);
- GET is the chosen method;
- retry control — see Q2/Q3; the spine's reconnect needs are met by the native model
  plus a re-sync fetch.

So on raw protocol fit, **native `EventSource` satisfies the spine contract with no
gap.** The fetch-based client's differentiators are all unused capabilities here.

The fetch-based path's cookie story is also fine if it were chosen: it runs on
`fetch()`, whose `credentials` option "Defaults to `same-origin`," meaning a
same-origin request sends cookies by default [mdn-fetch-credentials]{1}. So cookie
auth is not a discriminator between the two on a same-origin spine — both send the
cookie automatically.

### The differentiator that *does* apply: reconnect/visibility control

Where the fetch library earns its place is richer reconnect control and Page
Visibility integration: by default it "closes if the document is hidden... and
automatically retries with the last event ID when it becomes visible again," with
`openWhenHidden: true` to opt out, and an `onerror` retry contract where you "throw
err" to stop or "do nothing to automatically retry" / "return a specific retry
interval" [microsoft-fetch-event-source]{3}. Against the `maxConnections` cap, the
hidden-tab auto-close is a double-edged property: it frees a server connection slot
when a tab is backgrounded (helpful under the cap) but it also forces a reconnect +
re-sync on every tab refocus (see Q2 — costly precisely because the spine has no
resume). Native `EventSource` keeps the connection open when hidden, holding a slot
but avoiding refocus churn.

**Assessment:** native `EventSource` is the lower-complexity fit for the fixed spine
contract; the fetch-based client buys capabilities (POST/body/headers, manual retry
policy, visibility-driven close) the contract does not require. The decision between
them is a connection-budget-and-visibility-policy call, not a protocol-fit call —
flagged for the integration/architecture facet, since it interacts with the
`maxConnections` cap and the multiplex-per-tab decision rather than the wire format.

---

## Q2 — Reconnection model WITHOUT `Last-Event-ID`

### How native auto-reconnect behaves

On a network-level drop the UA reconnects automatically: "if res is a network error,
then reestablish the connection, unless the user agent knows that to be futile."
Reconnect waits "a delay equal to the reconnection time of the event source," and
the UA may layer exponential backoff on top [whatwg-sse-eventsource]{1}. During the
wait `readyState` returns to `CONNECTING`; on success it goes to `OPEN` and fires
`open` [whatwg-sse-eventsource]{1}.

### Last-Event-ID is conditional on the server having sent `id:`

The UA sends the `Last-Event-ID` header on reconnect **only if** the last-event-ID
buffer is non-empty: "If the EventSource object's last event ID string is not the
empty string: ... Set (`Last-Event-ID`, lastEventIDValue) in request's header list."
That buffer is populated *only* by an `id:` field on a received event
[whatwg-sse-eventsource]{1}. The spine sends no `id:` ever, so the buffer stays
empty and **no `Last-Event-ID` header is ever sent.** This is consistent: with no
ids there is nothing to resume from, and the browser correctly doesn't ask for a
resume.

### Default retry interval

The spec does **not** fix a numeric default — the initial reconnection time "must
initially be an implementation-defined value, probably in the region of a few
seconds" [whatwg-sse-eventsource]{1}. So the unhinted default is per-browser (order
of a few seconds), which is exactly why the spine sends an explicit `retry:` (see
Q3) rather than relying on the browser default.

### Client re-sync obligation (the load-bearing consequence)

Because there is no event replay, a reconnect can miss events that occurred during
the gap. The client must treat each `open`/reconnect as a "rebuild authoritative
state" trigger rather than "resume where I left off": on (re)connect, perform a full
re-fetch of the authoritative state for each topic (live/playout/content) via the
normal REST endpoints, then let subsequent SSE events apply deltas on top. The
`spine.connected` handshake event is the natural re-sync signal — it fires on every
fresh connection, so binding the full re-fetch to `spine.connected` (rather than to
the low-level `open`) gives an application-level "the stream is live again, resync
now" hook. This makes the SSE stream a *cache-invalidation / push-update channel*
layered over REST-of-record, not a sole source of truth — the correct architecture
when there is no resume guarantee. (The re-fetch wiring itself is the
react-integration facet's to specify; this facet establishes *that* a full re-sync
is mandatory and *why*.)

---

## Q3 — `retry:` hint and lifetime-close interaction

### Server `retry:` overrides the browser default

A `retry:` field whose value "consists of only ASCII digits" sets "the event
stream's reconnection time to that integer" (milliseconds); non-digit values are
ignored [whatwg-sse-eventsource]{1}. So the spine's 2–5s `retry:` hint replaces the
browser's implementation-defined default for all subsequent auto-reconnects on that
stream. Because `retry:` is sticky on the stream's state, the spine only needs to
send it once (e.g. alongside the handshake) and it governs every later reconnect
until overridden.

### Does the ~4h lifetime-close trigger auto-reconnect?

Yes — and this is the key clean-close behavior. A server closing the TCP stream
(after sending a complete event) is a network-level connection drop from the client's
view, which the spec routes to "reestablish the connection" rather than to "fail the
connection" [whatwg-sse-eventsource]{1}. Critically, an HTTP-200 SSE stream that the
server simply *ends* is **not** one of the terminal cases: the spec's "fail the
connection" path (which sets `readyState = CLOSED`, fires a fatal `error`, and "does
not attempt to reconnect") is reserved for a non-200 status or a wrong
`Content-Type` [whatwg-sse-eventsource]{1}. So the planned ~4h server close lands on
the *reconnect* path: the client waits the `retry:` interval and re-opens
automatically, with no application code needed to drive the reconnect. The jittered
±15% lifetime is what staggers those reconnects across tabs so they don't stampede.

### error vs close semantics (what the client must distinguish)

- **Reconnectable (lifetime close, network blip):** surfaces as the `error` event
  while `readyState` is `CONNECTING` (the UA is already retrying). The client should
  *not* tear down — the browser is handling it; the client only needs to know a
  re-sync is pending on the next `spine.connected`.
- **Terminal (non-200 / wrong content-type / explicit `close()`):** `readyState` is
  `CLOSED` and the UA "does not attempt to reconnect" [whatwg-sse-eventsource]{1}.
  This is where the client must take over (e.g. an auth-expiry 401/403 on reconnect
  would land here — the cookie session lapsed — and the client should route to
  re-auth rather than spin).

The practical client rule: inspect `readyState` inside the `error` handler.
`CONNECTING` ⇒ transient, let the browser retry; `CLOSED` ⇒ terminal, app must act.
A non-200 (e.g. session-expired) is the case that breaks native auto-reconnect and
needs explicit handling — and is the one scenario where the fetch-based client's
`onerror`-inspects-response capability would matter, if the connection-budget
analysis (Q1) ends up selecting it for other reasons.

To stop reconnection deliberately, the server returns **HTTP 204 No Content**, the
documented signal to halt retries [whatwg-sse-eventsource]{1} (relevant if the spine
ever wants to shed a client under the `maxConnections` cap without the client
immediately re-dialing).

---

## Disconfirming analysis

- **"Native EventSource can't do cookie auth" — checked, false.** A same-origin
  `EventSource` sends cookies; `withCredentials` only concerns *cross-origin* CORS
  credentials, which the same-origin spine does not need [mdn-eventsource]{2}. The
  cookie-auth requirement does *not* push toward the fetch-based client. The
  fetch-based client also sends cookies same-origin by default
  [mdn-fetch-credentials]{1}, so cookie auth is neutral between the two.

- **"The server close at 4h will fire a fatal error and the client must reconnect
  manually" — checked, false.** A clean end of an HTTP-200 stream is a
  network-level close, routed to *reestablish*, not *fail*; only non-200 /
  wrong-content-type / explicit `close()` are terminal
  [whatwg-sse-eventsource]{1}. No manual reconnect code is needed for the lifetime
  close.

- **"Default retry is 3 seconds" — checked, unsupported.** The spec fixes no
  numeric default ("implementation-defined value, probably in the region of a few
  seconds") [whatwg-sse-eventsource]{1}. Any specific number (e.g. 3000ms) is a
  per-browser implementation detail, not a spec guarantee — which is the reason the
  spine sends an explicit `retry:`. Stated as a relative anchor, not a fixed figure.

- **Fetch-library "automatically retries with the last event ID" vs the no-`id:`
  spine.** The README's visibility-refocus reconnect advertises retry "with the last
  event ID" [microsoft-fetch-event-source]{3}; against this spine that last-event-ID
  is always empty, so the refocus reconnect behaves like a fresh connect requiring
  full re-sync — the library's resume-on-refocus value is nullified by the spine's
  no-`id:` constraint. This *weakens* the case for the fetch-based client on this
  spine specifically.

## Contradictions

No source-level contradictions surfaced. MDN and the WHATWG spec are consistent
(MDN being the developer-facing restatement of the spec); the fetch-library README
describes a different primitive (fetch-based) and does not contradict the spec's
`EventSource` semantics — it explicitly enumerates `EventSource`'s limits, which the
spec corroborates.

## Revisit if

- The spine starts emitting `id:` fields (would re-enable `Last-Event-ID` resume and
  change the re-sync-on-reconnect obligation from "always full re-fetch" to "replay
  from last id").
- The endpoint moves cross-origin (would require `withCredentials: true` on
  `EventSource`, or `credentials: 'include'` on the fetch-based client, and a CORS
  preflight/allow-credentials story).
- A POST body, custom request header, or per-connection auth header (e.g. bearer
  token instead of cookie) becomes required — that flips the Q1 fit decisively
  toward the fetch-based client, since native `EventSource` cannot do any of those
  [microsoft-fetch-event-source]{3}.
- `@microsoft/fetch-event-source` ships a new release or gets deprecated (last
  publish 2.0.1 / 2021-04-25, currently not deprecated [microsoft-fetch-event-source]{3});
  if the fetch path is selected, its 2021-era maintenance status is a standing risk
  the architecture facet should weigh.

## Acquisition candidates

- **(enriching)** A maintained fetch-based SSE client as a fresher alternative to
  `@microsoft/fetch-event-source` (whose last publish is 2021) — candidate
  `eventsource-parser` / `@microsoft/fetch-event-source` successors are *named in*
  the fetch library's ecosystem but were not fetched this session; source-bound
  acquisition would require fetching a maintained-alternatives comparison page. Only
  relevant if Q1 selects the fetch-based path.
- **(enriching)** MDN "Using server-sent events" guide full page — fetched this
  session but the reconnection/`id:`/204 prose was not in the returned excerpt; the
  WHATWG spec covered those normatively, so this is non-blocking. Re-fetch only if a
  developer-facing restatement is wanted for the integration facet.
