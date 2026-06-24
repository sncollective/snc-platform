---
source_handle: srs-platform-conf
source_class: tool-doc
fetched: 2026-06-24
source_path: platform/srs.conf
provenance: source-direct
tool: SRS — platform dev configuration (srs.conf)
version: dev (platform repo)
topic: HLS config (hls_fragment=2, hls_window=10), DVR absent, callbacks, HTTP server
---

# SRS — platform dev configuration

## Paraphrased summary

The platform's SRS dev config (at `platform/srs.conf`) reveals the actual deployed HLS
parameters. HLS is enabled with `hls_fragment 2` (2-second segments) and `hls_window 10`
(10 seconds of segments retained = ~5 segments). DVR is **not configured** in this file.
The HTTP callbacks are `on_publish` and `on_unpublish` only; `on_hls` and `on_dvr` are
absent. The HTTP server serves HLS files from `/usr/local/srs/objs/nginx/html` on port 8080.
The HTTP API is on port 1985 with RAW API enabled (`allow_reload on`).

## Key passages

- **HLS config:**
  ```
  hls {
      enabled on;
      hls_fragment 2;
      hls_window 10;
  }
  ```
  → 2-second segments, 10-second rolling window (~5 segments retained live)
- **No DVR block** — DVR is not enabled in the platform's SRS config.
- **No `on_hls` or `on_dvr` callbacks** — only `on_publish` and `on_unpublish`.
- **HTTP server:** port 8080, dir `/usr/local/srs/objs/nginx/html`
- **HTTP API:** port 1985, `raw_api { enabled on; allow_reload on; }`
- **Forward dynamic backend:** `http://host.docker.internal:3000/api/streaming/callbacks/on-forward`

## Structural metadata

- This is the source-of-truth for what SRS actually does in the platform's dev environment.
- `hls_fragment 2` + `hls_window 10` is an aggressive (low-latency) HLS config.
- The absence of DVR means: no DVR file is written, no `on_dvr` callback fires, no session
  recording exists by default. VOD clipping from a completed stream requires DVR to be enabled
  OR the stream to have been archived by another mechanism.
- `hls_window 10` means segments older than 10 seconds are deleted from disk during live
  streaming — the rolling HLS window does not constitute a persistent recording.
