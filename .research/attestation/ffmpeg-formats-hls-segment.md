---
source_handle: ffmpeg-formats-hls-segment
source_class: tool-doc
fetched: 2026-06-24
source_url: https://ffmpeg.org/ffmpeg-formats.html
provenance: source-direct
tool: FFmpeg — formats documentation (ffmpeg-formats.html)
topic: HLS muxer options, segment muxer options, hls_flags
---

# FFmpeg — formats docs: HLS muxer and segment muxer

## Paraphrased summary

The FFmpeg HLS muxer (section 4.46) outputs `.m3u8` playlists and `.ts` segment files.
Key options: `hls_time` controls segment duration (fractional seconds), `hls_list_size`
controls playlist size, `hls_segment_filename` controls segment naming. `hls_flags` includes
`delete_segments` (removes old segments from disk), `append_list` (appends to existing
playlists), and `split_by_time` (splits at specified intervals). The `start_number` sets
initial segment numbering. The segment muxer (section 4.70) is listed with options including
`segment_time`, `segment_list`, `segment_format`, `reset_timestamps`, and
`segment_start_number` — but the fetched content truncated before the detailed option
descriptions. For MP4 fragmentation, `movflags +frag_keyframe` is noted in the MOV/MP4 section
for keyframe-aligned fragmentation.

## Key passages

- **`hls_time`:** "Sets segment duration length (fractional seconds supported)" `[unverified-exact]`
- **`hls_flags delete_segments`:** removes earlier segments from disk `[unverified-exact]`
- **`hls_flags split_by_time`:** segments split at specific intervals `[unverified-exact]`
- **Segment muxer options** (table of contents only; detailed text truncated): `segment_time`,
  `segment_list`, `segment_format`, `reset_timestamps`, `segment_start_number`.
- **`movflags +frag_keyframe`:** keyframe-based fragmentation for MP4 container. `[unverified-exact]`

## Structural metadata

- The HLS muxer produces `.m3u8` + `.ts` files locally; this is the FFmpeg-side equivalent
  of what SRS does server-side for HLS output.
- `split_by_time` is relevant when cutting at time boundaries rather than keyframes (but
  still requires a keyframe at the boundary for clean decode).
- Segment muxer full option details not confirmed from this fetch due to content truncation.
