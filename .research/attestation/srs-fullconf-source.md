---
source_handle: srs-fullconf-source
source_class: github-readme
fetched: 2026-06-16
source_url: https://github.com/ossrs/srs/blob/develop/trunk/conf/full.conf
provenance: source-direct
substrate_confidence: search-summary
tool: SRS — full.conf reference config (develop branch, source repo)
version: develop (SRS 6.x line)
topic: authoritative config reference — transcode vcodec, engine blocks, output variables, forward backend, rtc
---

# SRS — full.conf reference config (source repo)

Engagement note: fetched the raw GitHub config via WebFetch (raw.githubusercontent.com 500'd;
the blob URL via WebFetch returned a summary). This is the authoritative in-source config
reference with inline comments. Body is the WebFetch summary of those comments, not a byte copy.

## Paraphrased summary

`trunk/conf/full.conf` is SRS's exhaustive annotated config. Transcode runs ffmpeg as an
external child process (path set via `ffmpeg <path>`). The `vcodec` parameter (mapped to
ffmpeg `-vcodec`) is documented with these values: **`libx264`** (H.264 software encode),
**`copy`** (passthrough, no re-encode), **`png`** (thumbnail snapshot), **`vn`** (disable
video). The annotated value list in this file enumerates only those software/passthrough
options — it does NOT enumerate hardware encoders (h264_nvenc / h264_vaapi / h264_qsv) as
supported `vcodec` values. Each `engine` block defines one transcode output; multiple `engine`
blocks under one `transcode` produce multiple distinct outputs (the basis for an ABR ladder).
The `output` parameter is a templated RTMP URL supporting `[vhost]`, `[app]`, `[stream]`,
`[engine]` variables. A `vfilter` section holds ffmpeg filters between `-i` and `-vcodec`.
The `forward` block carries `backend <url>` for dynamic forward. The `rtc` block carries
`rtmp_to_rtc` / `rtc_to_rtmp` transmux toggles.

## Key passages

- **vcodec documented values:** "video encoder name, 'ffmpeg -vcodec' can be: libx264: use
  h.264(libx264) video encoder. png: use png to snapshot thumbnail. copy: donot encoder the
  video stream, copy it. vn: disable video output." `[unverified-exact]`
  → No hardware encoder (vaapi/nvenc/qsv) is listed among the documented `vcodec` values.
- **engine block:** "the transcode engine for matched stream. all matched stream will
  transcoded to the following stream." Multiple engine blocks = multiple outputs.
- **output template:** `output rtmp://127.0.0.1:[port]/live/livestream?vhost=[vhost];` with
  `[vhost]`/`[app]`/`[stream]`/`[engine]` substitution.
- **vfilter:** "ffmpeg filters, between '-i' and '-vcodec' follows the main input."
- **forward backend:** `forward { enabled on; destination ...; backend http://...; }`.
- **rtc:** `rtmp_to_rtc` (transcode aac→opus on transmux), `rtc_to_rtmp` with `pli_for_rtmp`.

## Structural metadata

- This is the develop-branch config (the SRS 6.x line; our deployed image is `ossrs/srs:6`).
- full.conf is the canonical superset reference; production configs subset it. Transcode is
  off by default and, when on, spawns ffmpeg per engine — a CPU-bound server-side process.
