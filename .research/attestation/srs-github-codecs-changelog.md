---
source_handle: srs-github-codecs-changelog
source_class: github-readme
fetched: 2026-06-16
source_url: https://github.com/ossrs/srs
provenance: source-direct
substrate_confidence: search-summary
tool: SRS GitHub README + v6.0 release changelog entries
version: SRS 6.0 line
topic: SRS 6 protocol/codec matrix; v6.0 changelog highlights (H.265, WHEP, SRT latency)
---

# SRS GitHub README + v6.0 changelog highlights

Engagement note: WebFetch/WebSearch summary of the repo README tagline and several v6.0
release changelog lines. The README tagline is a stable, oft-quoted source-direct string; the
changelog lines are reported from release notes.

## Paraphrased summary

The SRS repo README states SRS is "a simple, high-efficiency, real-time media server
supporting RTMP, WebRTC, HLS, HTTP-FLV, HTTP-TS, SRT, MPEG-DASH, and GB28181, with codec
support for H.264, H.265, AV1, VP9, AAC, Opus, and G.711." The v6.0 release line added,
among others: H.265/HEVC across more protocols (HEVC over SRT at v6.0.20; H.265 for GB28181
at v6.0.25), an A/V-only WHEP player (v6.0.116), a WHIP→RTMP/HLS conversion fix (v6.0.113),
and SRT latency reduction to ~200ms in srt2rtc.conf (v6.0.24). A dedicated HEVC doc exists at
`/docs/v6/doc/hevc`.

## Key passages

- **Protocol/codec matrix (README tagline):** "supporting RTMP, WebRTC, HLS, HTTP-FLV,
  HTTP-TS, SRT, MPEG-DASH, and GB28181, with codec support for H.264, H.265, AV1, VP9, AAC,
  Opus, and G.711."
- **v6.0 changelog (reported):** HEVC over SRT (v6.0.20); H.265 for GB28181 (v6.0.25); SRT
  ~200ms latency in srt2rtc.conf (v6.0.24); A/V-only WHEP player (v6.0.116); WHIP→RTMP/HLS fix
  (v6.0.113). `[unverified-exact]`

## Structural metadata

- README protocol/codec list is the server's headline capability claim; per-protocol codec
  support varies (e.g. H.265 over RTMP/HTTP-FLV/SRT documented; WebRTC common-path is H.264).
- Changelog entries date the v6.0 line's feature accretion; our deployed image `ossrs/srs:6`
  tracks the v6 major.
