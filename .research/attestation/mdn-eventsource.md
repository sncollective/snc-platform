---
source_handle: mdn-eventsource
source_class: tool-doc
fetched: 2026-06-15
source_url: https://developer.mozilla.org/en-US/docs/Web/API/EventSource
provenance: source-direct
substrate_confidence: source-direct
tool: MDN Web Docs — EventSource API
version: fetched 2026-06-15
topic: EventSource interface (constructor, withCredentials, events)
---

# MDN Web Docs — `EventSource`

## Paraphrased summary

MDN documents the `EventSource` interface as the developer-facing reference for the
WHATWG SSE algorithm. The constructor takes a URL and an optional init dict whose
`withCredentials` member controls whether the connection is opened in CORS
credentials mode. The `withCredentials` property reflects whether the object was
instantiated with cross-origin CORS credentials (`false` by default). MDN lists the
`open`, `message`, and `error` events, and notes that the server can emit ad-hoc
named events (keyed by the stream's `event:` field) which are received via
`addEventListener(<name>, ...)`.

## Key passages

- **Constructor:** "Creates a new `EventSource` to handle receiving server-sent
  events from a specified URL, optionally in credentials mode."

- **withCredentials:** "A boolean value indicating whether the `EventSource` object
  was instantiated with cross-origin (CORS) credentials set (`true`), or not
  (`false`, the default)."

- **Events:**
  - `open` — "Fired when a connection to an event source has opened."
  - `message` — "Fired when data is received from an event source."
  - `error` — "Fired when a connection to an event source failed to open."

- **Named events:** "the event source itself may send messages with an event field,
  which will create ad hoc events keyed to that value." (Consumed via
  `addEventListener(<event-name>, handler)`.)

## Structural metadata

`tool-doc` (MDN reference page for the `EventSource` interface). Secondary to the
WHATWG spec for normative semantics; used here for the developer-facing
constructor/event surface and the `withCredentials` default. NOTE: the fetched
top-level interface page did not carry the reconnection-timing prose — that detail
is taken from the WHATWG spec (`whatwg-sse-eventsource`), not asserted from this
page.

## Substrate-test

Usable without platform context: documents the `EventSource` API surface on MDN's
terms. No project framing.
