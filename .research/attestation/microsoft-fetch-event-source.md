---
source_handle: microsoft-fetch-event-source
source_class: github-readme
fetched: 2026-06-15
source_url: https://github.com/Azure/fetch-event-source
provenance: source-direct
substrate_confidence: source-direct
repo: Azure/fetch-event-source
package: "@microsoft/fetch-event-source"
version: 2.0.1
published: 2021-04-25
license: MIT
---

# `@microsoft/fetch-event-source` — README (Azure/fetch-event-source)

## Paraphrased summary

`@microsoft/fetch-event-source` is a TypeScript library that reimplements the SSE
client over the `fetch()` API instead of native `EventSource`, to lift the four
limitations the README attributes to `EventSource`: no request body, no custom
headers, GET-only, and no control over the retry strategy. `fetchEventSource(url,
options)` accepts the full `fetch` option set (`method`, `headers`, `body`,
`signal`, plus the rest) alongside lifecycle callbacks `onopen` / `onmessage` /
`onclose` / `onerror`. Retry is application-controlled: `onerror` re-throws a fatal
error to stop, or does nothing / returns a number to retry (with an interval). The
library integrates the Page Visibility API — by default it closes the connection
when the document is hidden and reconnects (with the last event ID) when visible
again; `openWhenHidden: true` opts out. Latest published version is 2.0.1 (npm
registry, published 2021-04-25, MIT, no deprecation marker).

## Key passages

- **EventSource limitations (verbatim list):**
  - "You cannot pass in a request body: you have to encode all the information
    necessary to execute the request inside the URL, which is limited to 2000
    characters in most browsers."
  - "You cannot pass in custom request headers"
  - "You can only make GET requests - there is no way to specify another method."
  - "If the connection is cut, you don't have any control over the retry strategy:
    the browser will silently retry for you a few times and then stop, which is not
    good enough for any sort of robust application."
  - (also) lack of "access to the response object if you want to do some custom
    validation/processing before parsing the event source."

- **API surface:** `fetchEventSource(url, options)` with callbacks `onopen`,
  `onmessage`, `onclose`, `onerror`, plus `method`, `headers`, `body`, `signal`,
  and "all the other parameters exposed by the default fetch API."

- **onerror retry contract:** "if (err instanceof FatalError) { throw err; } else {
  // do nothing to automatically retry. You can also return a specific retry
  interval here. }"

- **Page Visibility:** the library "plugs into the browser's Page Visibility API so
  the connection closes if the document is hidden (e.g., the user minimizes the
  window), and automatically retries with the last event ID when it becomes visible
  again." `openWhenHidden` opts out of this auto-close.

- **Registry metadata (npm `@microsoft/fetch-event-source`):** dist-tag `latest` =
  **2.0.1**, published **2021-04-25T18:54:56Z**; license **MIT**; description "A
  better API for making Event Source requests, with all the features of fetch()";
  **no `deprecated` marker** in the registry record. (Registry `modified` timestamp
  2026-04-23 reflects registry-side metadata churn, not a new publish — the latest
  version remains 2.0.1 from 2021.)

## Structural metadata

`github-readme` + npm registry record. The README states the design rationale; the
registry record carries the maintenance signal (last *publish* 2021-04-25, no
newer version, not deprecated). Load-bearing for the "native vs fetch-based client"
question on the transport facet.

## Substrate-test

Usable without platform context: documents the library's own rationale and API on
its terms, plus public npm metadata. No project framing or composed claims.
