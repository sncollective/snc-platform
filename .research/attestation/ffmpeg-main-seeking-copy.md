---
source_handle: ffmpeg-main-seeking-copy
source_class: tool-doc
fetched: 2026-06-24
source_url: https://ffmpeg.org/ffmpeg.html
provenance: source-direct
tool: FFmpeg — main documentation (ffmpeg.html)
topic: -ss/-to seeking (input vs output), -c copy stream copy, -accurate_seek, -force_key_frames
---

# FFmpeg — main documentation: seeking + stream copy

## Paraphrased summary

FFmpeg's `-ss` seeking behaves differently depending on placement. **Input-side seeking** (before
`-i`) seeks to the nearest seek point *before* the position — in most formats this is the
preceding keyframe. **Output-side seeking** (after the input specification) decodes and discards
packets until timestamps reach position. Stream copy (`-c copy`) bypasses decode/encode entirely
— it copies packets as-is, with "no quality loss" and very fast execution — but cannot apply
filters. When `-ss` is used input-side with stream copy (or `-noaccurate_seek`), the extra
segment between the keyframe and the target position is *preserved* rather than decoded and
discarded. With transcoding and `-accurate_seek` (the default), that extra segment is decoded
and discarded for precise cutting. The `-force_key_frames` option can be given timestamps or an
expression, forcing a keyframe at frames matching the condition; the `source` variant forces a
keyframe whenever the source marks one.

## Key passages

- **Input-side `-ss`:** "seeks in this input file to position. Note that in most formats it is
  not possible to seek exactly, so ffmpeg will seek to the closest seek point before position."
  `[unverified-exact]`
- **Output-side `-ss`:** "decodes but discards input until the timestamps reach position."
  `[unverified-exact]`
- **`-c copy` / stream copy:** "copying one input elementary stream's packets without decoding,
  filtering, or encoding them." "it is very fast and there is no quality loss." `[unverified-exact]`
- **`-accurate_seek` with input-side seek:** "When transcoding and -accurate_seek is enabled
  (the default), this extra segment between the seek point and position will be decoded and
  discarded. When doing stream copy or when -noaccurate_seek is used, it will be preserved."
  `[unverified-exact]`
- **`-force_key_frames time[,time...]`:** "ffmpeg will round the specified times to the nearest
  output timestamp as per the encoder time base and force a keyframe at the first frame having
  timestamp equal or greater than the computed timestamp." `[unverified-exact]`
- **`-to` and `-t` mutual exclusivity:** "The options -to and -t are mutually exclusive and -t
  has priority." `[unverified-exact]`

## Structural metadata

- Source: official FFmpeg docs at ffmpeg.org/ffmpeg.html (the `ffmpeg` tool man page).
- The "preserved" behavior of stream copy + input-side seek means the clip may start with
  non-keyframe packets that decoders may display as corrupted/grey frames until the first
  keyframe within the clip.
- This is the load-bearing source for the GOP-alignment limitation on stream-copy clip extraction.
