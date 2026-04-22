---
name: srs-v6
description: >
  SRS v6 (Simple Realtime Server) streaming reference. Auto-loads when working with
  SRS, RTMP, HLS streaming, stream callbacks, live streaming, on_publish, on_unpublish,
  WHIP, WHEP, WebRTC streaming, streaming server, srs.conf, forward, simulcast,
  edge, relay, SRT ingest, raw_api, config reload.
user-invocable: false
updated: 2026-04-13
---

# SRS v6 Reference

> **Version:** 6.x
> **Docs:** https://ossrs.io/lts/en-us/docs/v6/doc/introduction

See [reference.md](reference.md) for the full HTTP API and callback reference.

## Key Gotchas

### Three Different Ports

SRS exposes services on separate ports — don't mix them up:

| Port | Service | Purpose |
|------|---------|---------|
| 1935 | RTMP | Stream publishing (OBS, FFmpeg) |
| 1985 | HTTP API | Management, stream queries, health checks |
| 8080 | HTTP Server | HLS playback (`.m3u8` and `.ts` files) |

### Callback Response Format

Callbacks **must** return HTTP 200 with either:
- Integer `0` in the body
- JSON `{"code": 0}` (with optional `"msg"`)

Any other response (non-200 status, non-zero code, or malformed body) causes SRS to **disconnect the client**. This is how stream authentication works — return non-zero to reject.

### Stream Key via `param` Field

SRS passes the RTMP URL query string in the `param` field of callbacks. For example, if a publisher connects to `rtmp://server/live/stream?key=secret123`, the callback receives:
```json
{ "stream": "stream", "param": "?key=secret123" }
```
Parse the `param` field to extract authentication tokens.

### HLS Fragment Size

SRS defaults to 10-second HLS fragments. For lower-latency streaming, configure smaller fragments:
```
hls {
    enabled on;
    hls_fragment 2;    // seconds per .ts segment
    hls_window 10;     // total playlist duration in seconds
}
```
Smaller fragments = lower latency but more HTTP requests from players.

### Stream Listing Default Limit

`GET /api/v1/streams` returns only 10 streams by default. Pass `?count=1000` (or appropriate number) to get all active streams:
```
GET /api/v1/streams?start=0&count=1000
```

### CORS Configuration

CORS is **not enabled by default**. Enable it in the config:
```
http_api {
    enabled on;
    listen 1985;
    crossdomain on;
}

http_server {
    enabled on;
    listen 8080;
    crossdomain on;
}
```

### Optional Basic Auth (v6.0.40+)

HTTP API authentication is optional but available:
```
http_api {
    enabled on;
    listen 1985;
    auth {
        enabled on;
        username admin;
        password admin;
    }
}
```
When enabled, use `http://user:pass@host:1985/api/v1/...` or standard HTTP Basic auth headers.

### Health Check Endpoint

Use `/api/v1/versions` for health checks — it's lightweight and always returns version info when SRS is running.

### Forward Backend vs Static Destination

Static `forward { destination ... }` only accepts `ip:port` — it mirrors the same app/stream path to the destination. For external platforms (Twitch, YouTube) that need custom RTMP paths with stream keys, you **must** use dynamic `forward { backend ... }` which returns full RTMP URLs.

### Forward Fires Once Per Publish

The forward backend is called once when a stream starts publishing. It is not called per-frame or per-segment. To change forward destinations mid-stream, the publisher must disconnect and reconnect.

### Config Reload via Raw API

SRS config changes (e.g., enabling/disabling forward) can be applied without restart using the raw API reload endpoint: `GET /api/v1/raw?rpc=reload`. Requires `raw_api { enabled on; allow_reload on; }` in config.

## Anti-Patterns

1. **Don't poll `/api/v1/streams` at high frequency** — SRS HTTP API supports ~370 req/s. Use callbacks for real-time events instead of polling.

2. **Don't forget abort signal/timeout on API calls** — SRS can hang under load. Always set a timeout (e.g., 5 second AbortSignal).

3. **Don't return non-zero code from callbacks unless you intend to reject** — SRS will disconnect the publisher/player immediately.

4. **Don't configure `on_play`/`on_stop` hooks unless needed** — every viewer connection triggers an HTTP callback, adding latency. Only enable if you need viewer-level tracking.

5. **Don't use 6-field cron-style scheduling for HLS** — SRS timing is configured in seconds, not cron expressions.

## Resources

- [SRS HTTP API Docs](https://ossrs.io/lts/en-us/docs/v6/doc/http-api)
- [SRS HTTP Callback Docs](https://ossrs.io/lts/en-us/docs/v6/doc/http-callback)
- [SRS HLS Docs](https://ossrs.io/lts/en-us/docs/v6/doc/hls)
- [SRS WebRTC Docs](https://ossrs.io/lts/en-us/docs/v6/doc/webrtc)
