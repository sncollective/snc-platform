---
source_handle: ffmpeg-clip-options
fetched: 2026-06-24
source_url: https://ffmpeg.org/ffmpeg.html#Main-options
provenance: source-direct
---

# FFmpeg — Main Options for Clipping

## Paraphrased Summary

FFmpeg's documentation for the core options used to extract clip segments from video files, including seek, duration, stream copy, and frame extraction.

## Seeking and Duration

**-ss position** (input or output):
- As input option: "seeks in this input file to position" — fast but may seek to keyframe, not exact position
- As output option: decodes but discards until timestamps reach position — slower but frame-accurate

**-t duration** (input or output):
Limits data read or written to the specified duration.

**-to position** (input or output):
Stops processing at a specified position. "-to and -t are mutually exclusive and -t has priority."

## Stream Copy Without Re-encoding

**-c copy**:
"The stream is not to be re-encoded." Preserves original quality while changing container or stream selection. Very fast; no quality loss. Limitation: when stream copying, cuts must fall on keyframes (I-frames), so -ss as input option for approximate seeking works cleanly with -c copy.

## Frame Extraction

**-vframes number** (output):
"Sets the number of video frames to output" — useful for extracting a thumbnail frame from a clip.

## Thumbnail Generation

**-vf thumbnail** (video filter):
Selects a representative thumbnail frame. Combined with `-frames:v 1` to extract a single frame as an image.

## Practical Clip Extraction Pattern

```
ffmpeg -ss [start_time] -i input.mp4 -t [duration] -c copy output.mp4
```

For exact frame-accurate cuts with re-encoding:
```
ffmpeg -i input.mp4 -ss [start_time] -to [end_time] output.mp4
```

## Key Passages

> "-c copy: The stream is not to be re-encoded" — "very fast and there is no quality loss."

> "-to and -t are mutually exclusive and -t has priority."
