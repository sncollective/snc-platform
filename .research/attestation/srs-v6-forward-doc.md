---
source_handle: srs-v6-forward-doc
source_class: tool-doc
fetched: 2026-06-16
source_url: https://ossrs.net/lts/en-us/docs/v6/doc/forward
provenance: source-direct
substrate_confidence: search-summary
tool: SRS (Simple Realtime Server) v6 — Forward documentation
version: v6
topic: RTMP forward (static destinations + dynamic on_forward backend), simulcast relay
---

# SRS v6 — Forward documentation

Engagement note: fetched via WebFetch, which returns a model-summarized rendering of the
page rather than a byte-exact copy. Config snippets and the on_forward JSON contract below
are reported as rendered by that summary; the on_forward request/response shape is
cross-confirmed by the in-repo `srs-v6` skill reference (our own prior source-direct capture,
used as corroboration, not as a citation target). Claims marked `[unverified-exact]` were
not byte-verified against the raw page.

## Paraphrased summary

SRS's forward feature relays a published stream to one or more other RTMP servers. It runs
inside a `vhost` block. Two modes: **static** destinations (fixed `ip:port` pairs declared in
config) and a **dynamic backend** (`backend <url>`) that SRS queries over HTTP on each
publish to learn the forward destinations at runtime. The static mode preserves the original
app/stream path at the destination and accepts only `ip:port` (not full RTMP URLs). The
dynamic backend returns **full RTMP URLs**, which is what enables routing to arbitrary
external platforms (Twitch/YouTube stream-key paths). The doc does not state a limit on the
number of forward destinations.

## Key passages

- **Config block (static + backend):**
  ```
  vhost __defaultVhost__ {
      forward {
          enabled on;
          destination 127.0.0.1:1936 127.0.0.1:1937;
          backend http://127.0.0.1:8085/api/v1/forward;
      }
  }
  ```
  `destination` accepts space-separated `{ip}:{port}` pairs; destinations are NOT full RTMP
  URLs (vhost/app/stream inferred from the incoming publish). `[unverified-exact]`

- **on_forward callback fires when a client publishes to the vhost.** SRS POSTs JSON:
  ```json
  {
      "action": "on_forward",
      "server_id": "vid-k21d7y2",
      "client_id": "9o7g1330",
      "ip": "127.0.0.1",
      "vhost": "__defaultVhost__",
      "app": "live",
      "tcUrl": "rtmp://127.0.0.1:1935/live",
      "stream": "livestream",
      "param": ""
  }
  ```

- **Backend response returns full RTMP URLs:**
  ```json
  { "code": 0, "data": { "urls": ["rtmp://127.0.0.1:19350/test/teststream"] } }
  ```
  Returning full URLs (unlike static `ip:port`) enables dynamic routing. `[unverified-exact]`

- **Dynamic forward semantics:** the `backend` endpoint is queried per-publish, allowing
  real-time forward-destination changes without restarting SRS. The doc does not specify a
  cap on the number of destinations. `[unverified-exact]`

## Structural metadata

- Page is under `/docs/v6/` — the SRS v6 documentation tree (our deployed major version).
- Forward is a per-vhost feature; it is push-all (every published stream on the vhost is
  forwarded), distinguished from Edge mode (pull-on-demand) elsewhere in the docs.
