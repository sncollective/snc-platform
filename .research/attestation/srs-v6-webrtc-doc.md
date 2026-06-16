---
source_handle: srs-v6-webrtc-doc
source_class: tool-doc
fetched: 2026-06-16
source_url: https://ossrs.net/lts/en-us/docs/v6/doc/webrtc
provenance: source-direct
substrate_confidence: search-summary
tool: SRS v6 — WebRTC (WHIP/WHEP) documentation
version: v6
topic: WebRTC ingest/playback, WHIP/WHEP endpoints, RTMP<->RTC transmux, audio transcode
---

# SRS v6 — WebRTC (WHIP/WHEP) documentation

Engagement note: WebFetch summary (not byte-exact). Endpoint paths are cross-confirmed by the
in-repo `srs-v6` skill reference (prior source-direct capture). Latency claims: the doc
qualitatively describes WebRTC as low-latency but the summary surfaced **no quantified latency
figure** on this page — quantified sub-second framing for WebRTC is widely attributed to SRS
elsewhere but is NOT asserted from this page. Marked `[unquantified-here]`.

## Paraphrased summary

SRS v6 supports WebRTC for both ingest and playback via the standardized WHIP (ingestion) and
WHEP (playback) HTTP signaling protocols, which replace earlier bespoke WebRTC URL formats.
The same logical stream (`app=live&stream=livestream`) is reachable across RTMP, HLS,
HTTP-FLV, WHIP, and WHEP — a single ingested stream feeds multiple output protocols. SRS
performs bidirectional transmux: RTMP→RTC (`rtmp_to_rtc`) and RTC→RTMP (`rtc_to_rtmp`).
Because RTMP audio is AAC and WebRTC audio is Opus, RTMP→RTC requires **audio transcode
(AAC→Opus)**; the reverse path can transcode Opus→AAC. Video can be transmuxed (H.264 is the
common-path codec) without re-encode.

## Key passages

- **WHIP (publish):** `http://localhost:1985/rtc/v1/whip/?app=live&stream=livestream`
- **WHEP (play):** `http://localhost:1985/rtc/v1/whep/?app=live&stream=livestream`
- **rtc block config (from full.conf summary):**
  ```
  rtc {
      enabled on;
      rtmp_to_rtc off;
      rtc_to_rtmp off;
      keep_bframe off;
      opus_bitrate 48000;
      aac_bitrate 48000;
      pli_for_rtmp 6.0;
  }
  ```
- **Audio transcode:** "Whether enable transmuxing RTMP to RTC. If enabled, transcode aac to
  opus." RTMP→WebRTC mandates AAC→Opus audio transcode. `[unverified-exact]`
- **Latency:** described as a low-latency protocol for "low-latency audio and video
  scenarios"; no numeric latency on this page. `[unquantified-here]`
- **Multi-protocol fan-out:** one stream is addressable across RTMP/HLS/HTTP-FLV/WHIP/WHEP
  with the same app/stream params.

## Structural metadata

- Page under `/docs/v6/` (our deployed major). WHIP/WHEP endpoints sit on the HTTP API port
  (1985), distinct from RTMP (1935) and the HTTP/HLS server (8080).
- `keep_bframe off` default is relevant: WebRTC commonly avoids B-frames; H.264 streams with
  B-frames may need the encoder configured accordingly for clean RTC transmux.
