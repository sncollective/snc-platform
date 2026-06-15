---
source_handle: whatwg-sse-eventsource
source_class: standard
fetched: 2026-06-15
source_url: https://html.spec.whatwg.org/multipage/server-sent-events.html
provenance: source-direct
substrate_confidence: source-direct
title: "Server-sent events — HTML Living Standard §9.2"
issuing_body: WHATWG
---

# WHATWG HTML Living Standard — Server-sent events (§9.2, the `EventSource` interface)

## Paraphrased summary

The HTML Living Standard defines the `EventSource` interface and the normative
algorithms for opening, parsing, reconnecting, and failing a server-sent-events
connection. An `EventSource` is constructed from a URL plus an optional
`EventSourceInit` dict whose only member is `withCredentials`. The transport is a
GET request with `Accept: text/event-stream` and cache mode `no-store`. The
response must be HTTP 200 with `Content-Type: text/event-stream` or the connection
fails. The interface exposes `readyState` (CONNECTING=0 / OPEN=1 / CLOSED=2), the
`open` / `message` / `error` events, and `close()`. The reconnection algorithm is
the load-bearing part: the UA reconnects automatically on a *network-level* drop,
waits the "reconnection time" (implementation-defined, "probably in the region of
a few seconds") before retrying, and lets the stream override that time with a
`retry:` field. The `Last-Event-ID` request header is sent on reconnect **only if**
a prior `id:` field set a non-empty last-event-ID buffer.

## Key passages

- **Constructor / withCredentials (§9.2.2):** constructor is
  `constructor(USVString url, optional EventSourceInit eventSourceInitDict = {})`.
  Step 7: "If the value of eventSourceInitDict's `withCredentials` member is true,
  then set corsAttributeState to Use Credentials and set ev's `withCredentials`
  attribute to true." Step 11: "Set request's cache mode to `no-store`." The UA may
  set `Accept: text/event-stream` (step 10).

- **Response validation (processResponse):** "if res's status is not 200, or if
  res's `Content-Type` is not `text/event-stream`, then fail the connection."

- **readyState constants (§9.2.2):** `CONNECTING = 0`, `OPEN = 1`, `CLOSED = 2`.
  On construction `readyState` is `CONNECTING`. On "announce the connection" the UA
  "sets the readyState attribute to OPEN and fires an event named open." On
  "reestablish the connection" it sets `readyState` back to `CONNECTING`.

- **Initial reconnection time (§9.2.2):** "A reconnection time, in milliseconds.
  This must initially be an implementation-defined value, probably in the region of
  a few seconds." (The spec does NOT fix a numeric default — it is per-browser.)

- **Reconnect wait (§9.2.3, "reestablish the connection"):** step 2 — "Wait a delay
  equal to the reconnection time of the event source." The UA may additionally apply
  exponential backoff or wait for network restoration.

- **`retry:` field sets reconnection time (§9.2.6):** "If the field name is 'retry'
  / If the field value consists of only ASCII digits, then interpret the field value
  as an integer in base ten, and set the event stream's reconnection time to that
  integer." (Non-digit values are ignored.)

- **Last-Event-ID is conditional (§9.2.3, reestablish):** "If the EventSource
  object's last event ID string is not the empty string: ... Set
  (`Last-Event-ID`, lastEventIDValue) in request's header list." The last-event-ID
  buffer is set only by an `id:` field: "If the field value does not contain U+0000
  NULL, then set the last event ID buffer to the field value." If no event ever
  carries `id:`, the buffer stays empty and **no `Last-Event-ID` header is sent on
  reconnect.**

- **Network error → reconnect (processResponse):** "if res is a network error, then
  reestablish the connection, unless the user agent knows that to be futile, in which
  case the user agent may fail the connection."

- **Fail the connection is terminal (§9.2.3):** on fail, the UA "sets the readyState
  attribute to CLOSED and fires an event named error... Once the user agent has
  failed the connection, it does not attempt to reconnect." Triggered by non-200
  status or wrong content-type. `close()` likewise aborts the fetch and sets CLOSED.

- **HTTP 204 stops reconnection (non-normative note):** a 204 No Content response is
  the documented way to tell the UA to stop reconnecting.

## Structural metadata

`standard` (WHATWG Living Standard, §9.2 "Server-sent events"). Defines the
normative `EventSource` semantics every browser implements. Load-bearing for the
SSE-consumer transport facet: it is the authority on auto-reconnect, the
`retry:`-override, and the conditional `Last-Event-ID` behavior.

## Substrate-test

Usable without platform context: documents the WHATWG `EventSource` algorithm on
its own terms. No project framing, no composed claims.
