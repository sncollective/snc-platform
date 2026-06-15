---
source_handle: mdn-fetch-credentials
source_class: tool-doc
fetched: 2026-06-15
source_url: https://developer.mozilla.org/en-US/docs/Web/API/RequestInit
provenance: source-direct
substrate_confidence: source-direct
tool: MDN Web Docs — RequestInit
version: fetched 2026-06-15
topic: fetch() credentials option (omit / same-origin / include) and default
---

# MDN Web Docs — `RequestInit.credentials` (fetch credentials mode)

## Paraphrased summary

MDN documents the `credentials` option of `fetch()` / `RequestInit`, which controls
whether cookies and other credentials accompany the request. It has three values —
`omit`, `same-origin`, `include` — and **defaults to `same-origin`** when not
specified. This is the grounding for whether a `fetch`-based SSE client (which runs
on `fetch()`) sends cookies on a same-origin request: by default it does.

## Key passages

- **`omit`:** "Never send credentials in the request or include credentials in the
  response."
- **`same-origin`:** "Only send and include credentials for same-origin requests."
- **`include`:** "Always include credentials, even for cross-origin requests."
- **Default:** "Defaults to `same-origin`."

## Structural metadata

`tool-doc` (MDN reference for the fetch `credentials` option). Load-bearing for the
cookie-auth assessment of the fetch-based SSE client path: `fetch` defaults to
`same-origin` credentials, so a same-origin SSE request carries cookies without any
extra option.

## Substrate-test

Usable without platform context: documents the fetch credentials option on MDN's
terms. No project framing.
