---
source_handle: srs-v6-http-callback-doc
source_class: tool-doc
fetched: 2026-06-16
source_url: https://ossrs.net/lts/en-us/docs/v6/doc/http-callback
provenance: source-direct
substrate_confidence: search-summary
tool: SRS v6 — HTTP callback (http_hooks) documentation
version: v6
topic: on_publish/on_unpublish/on_play/on_stop/on_dvr/on_hls callback contracts, response semantics
---

# SRS v6 — HTTP callback (http_hooks) documentation

Engagement note: WebFetch summary. Callback contracts cross-confirmed by the in-repo `srs-v6`
skill reference (prior source-direct capture).

## Paraphrased summary

SRS fires HTTP POST callbacks on stream lifecycle events when `http_hooks { enabled on; }` is
set per-vhost. The family: `on_publish` (publish starts), `on_unpublish` (publish stops),
`on_play` (playback starts, carries `pageUrl`), `on_stop` (playback stops), `on_dvr` (DVR file
reaped), `on_hls` (TS segment reaped), `on_hls_notify` (GET, for CDN push). `on_connect`/
`on_close` are deprecated (overlap publish/play). Every callback POSTs a shared JSON body
(server_id, action, client_id, ip, vhost, app, tcUrl, stream, param, stream_url, stream_id).
**Response contract:** must return HTTP 200 with body `0` or `{"code": 0}`; any non-200 or
non-zero code disconnects the client — this is how SRS implements authentication (return
non-zero to reject a publisher). Multiple URLs per event are allowed (space-separated).

## Key passages

- **on_publish request:**
  ```json
  {
    "server_id": "vid-0xk989d", "action": "on_publish", "client_id": "341w361a",
    "ip": "127.0.0.1", "vhost": "__defaultVhost__", "app": "live",
    "tcUrl": "rtmp://127.0.0.1:1935/live?vhost=__defaultVhost__",
    "stream": "livestream", "param": "",
    "stream_url": "video.test.com/live/livestream", "stream_id": "vid-124q9y3"
  }
  ```
- **on_unpublish:** same structure, `"action": "on_unpublish"`.
- **Response:** HTTP/200 with `0` or `{"code": 0}`. "Returns other than HTTP/200 or code 0
  trigger disconnection." `[unverified-exact]`
- **param field carries the RTMP query string** (e.g. `?key=secret123`) — the stream-key
  auth channel.
- **on_dvr / on_hls** are file-reap callbacks (include file/duration metadata).
- **on_connect/on_close deprecated** in favor of publish/play events.

## Structural metadata

- Page under `/docs/v6/`. http_hooks is a per-vhost block. The on_forward dynamic-forward
  backend (separate `forward { backend ... }` block, see `srs-v6-forward-doc`) is a distinct
  hook from this http_hooks family, though both POST similar JSON.
