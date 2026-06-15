---
source_handle: eventsource-npm-readme
source_class: github-readme
fetched: 2026-06-15
source_url: https://github.com/EventSource/eventsource
provenance: source-direct
substrate_confidence: source-direct
tool: eventsource (npm) — README
version: fetched 2026-06-15
topic: the `eventsource` npm package as a real WHATWG SSE client
---

# `eventsource` (npm) — README

## Paraphrased summary

The `eventsource` npm package is a real WHATWG/W3C-compatible server-sent-events
client, not a test double. It implements the SSE spec for use as an actual client
across runtimes (Node.js ≥20, modern browsers, Deno, Bun) and opens real HTTP
connections. The README frames it as a minimal spec-faithful client implementation,
explicitly "not specifically a jsdom polyfill." For tests this means it suits
running a consumer against a real or mock SSE *server* (integration-tier), not
isolating a unit under jsdom.

## Key passages

- **Description:** "WhatWG/W3C-compatible server-sent events/eventsource client."

- **Scope / philosophy:** the maintainers "attempt to implement an absolute minimal
  amount of features/changes beyond the specification." Works in "Node.js (≥20),
  modern browsers (Chrome 71+, Safari 11.3+, Firefox 65+), Deno, and Bun — not
  specifically a jsdom polyfill."

- **Install:** `npm install --save eventsource`

- **Usage:**
  ```js
  import {EventSource} from 'eventsource'
  const es = new EventSource('https://my-server.com/sse')
  es.addEventListener('notice', (event) => { console.log(event.data) })
  es.addEventListener('message', (event) => { console.log(event.data) })
  setTimeout(() => { es.close() }, 10_000)
  ```

- **License:** MIT.

## Structural metadata

`github-readme` (the `EventSource/eventsource` repository — npm fetch was 403, the
GitHub repo README is the source). Authoritative for what this package *is*: a real
spec-compliant SSE client. Relevant to this facet as the **integration-tier** option
(point the consumer at a real/mock SSE server) and as the disconfirming contrast to
"mock the global" — using it in a unit test would make real network attempts, which
is why this facet routes it to integration, not unit, testing.

## Substrate-test

Usable without platform context: documents the package on its own README's terms.
No project framing.
