---
source_handle: srs-src-v6
source_class: github-readme
fetched: 2026-06-18
source_path: platform/.research/reference/input/srs
source_url: https://github.com/ossrs/srs
provenance: source-direct
version: v6.0.48 (tag) @ commit 1d878c2daaf913ad01c6d0bc2f247116c8050338
version_note: >
  The running container reports SRS binary version 6.0.184 (via `docker exec snc-srs
  /usr/local/srs/objs/srs -v`). The GitHub tag v6.0.184 does not exist — the highest
  publicly-tagged stable release on the v6 line at time of fetch is v6.0.48. This audit
  uses v6.0.48 as the best available source approximation. The hook and forward
  architecture in question (on_publish / on_unpublish / on_forward_backend) is mature and
  stable across the v6 minor line; no source evidence of breaking changes between .48 and
  .184 was observed. All file:line anchors are relative to the v6.0.48 tree.
  {confidence: medium — source matches tag-line architecture; minor build differences possible}
---

## SRS v6 — Source-Direct Notes

SRS (Simple Realtime Server) is a C++ media server. Key files examined:

- `trunk/src/app/srs_app_http_hooks.cpp` — all HTTP callback implementations
- `trunk/src/app/srs_app_rtmp_conn.cpp` — RTMP connection lifecycle; hook dispatch ordering
- `trunk/src/app/srs_app_source.cpp` — SrsOriginHub: forwarder creation and on_publish hub
- `trunk/src/app/srs_app_forward.cpp` — SrsForwarder: per-destination forwarding coroutine
- `trunk/src/app/srs_app_config.cpp` — get_max_connections(), get_engine_vcodec()

### Callback payload fields (on_publish / on_unpublish)

`SrsHttpHooks::on_publish()` (hooks.cpp:123–165) builds the JSON object with these fields:
`server_id`, `service_id`, `action` ("on_publish"), `client_id`, `ip`, `vhost`, `app`,
`tcUrl`, `stream`, `param`, `stream_url`, `stream_id` (conditional — only if stream already
registered in statistic). The `stream_url` and `stream_id` fields are absent from our
`SrsOnPublishSchema` (streaming.routes.ts:74–82).

`SrsHttpHooks::on_unpublish()` (hooks.cpp:167–212) sends the same fields as on_publish with
`action` = "on_unpublish".

### on_publish rejection semantics

`SrsHttpHooks::on_publish()` (hooks.cpp:156–158) calls `do_post()`; on failure returns
`srs_error_wrap`. `SrsRtmpConn::http_hooks_on_publish()` (rtmp_conn.cpp:1459–1492) returns
this error to `SrsRtmpConn::publishing()` (rtmp_conn.cpp:945). If `http_hooks_on_publish()`
fails, the error propagates and the connection is terminated — publish is rejected.
`do_post()` (hooks.cpp:636–639) treats anything that is not HTTP 200 or 201 as an error:
```cpp
if (code != SRS_CONSTS_HTTP_OK && code != SRS_CONSTS_HTTP_Created) {
    return srs_error_new(ERROR_HTTP_STATUS_INVALID, "http: status %d", code);
}
```
Additionally (hooks.cpp:664–669): a JSON body with `"code"` != 0 is also treated as error.

### on_unpublish error-handling asymmetry

`SrsHttpHooks::on_unpublish()` (hooks.cpp:200–204) returns `void`. On callback failure:
```cpp
srs_warn("http: ignore on_unpublish failed, ...");
return;
```
Unlike on_publish, on_unpublish callback failures are SILENTLY IGNORED. SRS always tears
down the publisher regardless of callback response.

### on_forward_backend lifecycle and error propagation

`on_forward_backend` is NOT part of `http_hooks` in the RTMP conn's `http_hooks_on_*`
sequence. It fires through a separate path: `SrsOriginHub::on_publish()` (source.cpp:1115)
→ `create_forwarders()` (source.cpp:1468) → `create_backend_forwarders()` (source.cpp:1513)
→ `SrsHttpHooks::on_forward_backend()` (source.cpp:1533).

This is called from `SrsRtmpConn::acquire_publish()` (rtmp_conn.cpp:1134) AFTER
`http_hooks_on_publish()` succeeds (rtmp_conn.cpp:944–947). The full call order is:

1. `http_hooks_on_publish()` — our on-publish callback (auth)
2. `acquire_publish(source)` → `source->on_publish()` → `create_forwarders()` →
   `create_backend_forwarders()` → `on_forward_backend()` — our on-forward callback

If `on_forward_backend()` fails (non-2xx, non-zero code, malformed JSON, missing `data.urls`
array), `create_backend_forwarders()` returns error, `on_publish()` returns error,
`acquire_publish()` returns error. The publish does NOT proceed — the stream is silently
rejected without a second disconnect signal. The `on_unpublish` hook still fires (rtmp_conn
line 967 runs unconditionally after the publish block).

### on_forward_backend payload fields (source-confirmed)

`SrsHttpHooks::on_forward_backend()` (hooks.cpp:536–605):
`action` ("on_forward"), `server_id`, `service_id`, `client_id`, `ip`, `vhost`, `app`,
`tcUrl`, `stream`, `param`. No `stream_url` or `stream_id` (unlike on_publish/on_unpublish).

### on_forward_backend expected response format

`on_forward_backend()` (hooks.cpp:569–599) parses: outer JSON object → `data` key → object
→ `urls` key → array of strings. Any missing key returns error and the publish fails.
Our `on_forward` handler (streaming.routes.ts:351,361,369) returns
`{ code: 0, data: { urls: [...] } }` — this matches the required format exactly.

### max_connections — global connection limit (no separate stream/vhost cap found)

`SrsConfig::get_max_connections()` (config.cpp:2970–2982): default 1000, overridable via
`SRS_MAX_CONNECTIONS` env var or the config key `max_connections`. A source search surfaced no
separate `max_streams` / `max_vhosts` / max-publishers config getter — `max_connections` is the
sole global connection ceiling located in config.cpp. There is no
`max_vhosts` global limit exposed in the config API at this line. No separate
`max_streams` or `max_publishers` limit was found in the config source.

### vcodec default for transcode engine

`SrsConfig::get_engine_vcodec()` (config.cpp:6001–6015): returns empty string `""` when
no `vcodec` directive is set in the transcode engine block. The config parser accepts any
string — there is no source-level soft-enum enforcement of `libx264` vs `copy`. The string
is passed directly to FFmpeg at transcode time.

### Secret / callback authentication

SRS sends callbacks as plain HTTP POST requests. The URL from `srs.conf` (including any
query string) is preserved verbatim in `do_post()` (hooks.cpp:620–623):
```cpp
string path = uri.get_path();
if (!uri.get_query().empty()) {
    path += "?" + uri.get_query();
}
```
SRS does NOT add any HMAC, Authorization header, or custom signing — the entire auth
mechanism is via query params in the configured URL. Our `?secret=...` query-param approach
is the correct and only mechanism.

### ForwarderCoroutine error retry

`SrsForwarder::cycle()` (forward.cpp:168–196): on `do_cycle()` error, warns and retries
after `SRS_FORWARDER_CIMS` (3 seconds). The forwarder thread runs continuously for the
duration of the publish, retrying on RTMP connection failures to the target destination.
