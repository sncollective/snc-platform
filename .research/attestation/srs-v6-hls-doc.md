---
source_handle: srs-v6-hls-doc
source_class: tool-doc
fetched: 2026-06-16
source_url: https://ossrs.net/lts/en-us/docs/v6/doc/hls
provenance: source-direct
substrate_confidence: search-summary
tool: SRS v6 — HLS documentation
version: v6
topic: HLS output config, fragment/window tuning, latency floor, LL-HLS support
---

# SRS v6 — HLS documentation

Engagement note: WebFetch summary. Config defaults cross-confirmed by the in-repo `srs-v6`
skill reference.

## Paraphrased summary

SRS converts an incoming RTMP/SRT/WebRTC stream to HLS (requires H.264 video + AAC/MP3 audio
for direct remux; otherwise transcode). HLS is configured per-vhost. Default fragment is 10s,
default window is 60s, yielding roughly 30s end-to-end latency. Latency can be tuned down by
shrinking `hls_fragment`/`hls_window`, but the doc states the HLS delay **won't go below ~5s**
even tuned, and that **SRS does not implement Low-Latency HLS (LL-HLS)**. For sub-5s targets
the doc points to HTTP-FLV, SRT, or WebRTC instead.

## Key passages

- **Config block:**
  ```
  vhost __defaultVhost__ {
      hls {
          enabled on;
          hls_fragment 10;
          hls_window 60;
          hls_path ./objs/nginx/html;
          hls_m3u8_file [app]/[stream].m3u8;
          hls_ts_file [app]/[stream]-[seq].ts;
      }
  }
  ```
- **Latency:** "its main issue is high latency, usually around 30 seconds" (with defaults).
  `[unverified-exact]`
- **LL-HLS not implemented:** "Even after adjusting, the HLS delay won't be less than 5
  seconds, and the LLHLS protocol can't reduce it further" — i.e. SRS does not provide LL-HLS;
  for lower latency use HTTP-FLV/SRT/WebRTC. `[unverified-exact]`
- **Conversion requirement:** "SRS converts RTMP, SRT, or WebRTC streams into HLS streams";
  H.264 + AAC/MP3 required for direct remux.

## Structural metadata

- Page under `/docs/v6/`. HLS files are served by the HTTP server (port 8080 in our deploy),
  separate from the HTTP API (1985).
- `hls_dispose` (how long HLS files persist after stream end) is documented on this feature
  but was surfaced via the in-repo skill, not this summary.
