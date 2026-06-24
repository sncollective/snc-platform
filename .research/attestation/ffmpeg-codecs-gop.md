---
source_handle: ffmpeg-codecs-gop
source_class: tool-doc
fetched: 2026-06-24
source_url: https://ffmpeg.org/ffmpeg-codecs.html
provenance: source-direct
tool: FFmpeg — codec documentation (ffmpeg-codecs.html)
topic: -g (GOP size / keyframe interval) generic codec option default
---

# FFmpeg — codec docs: GOP size default

## Paraphrased summary

The generic codec option `-g` sets the group-of-pictures (GOP) size. The documented default
value is 12. For libx264 specifically, the libx264 section was truncated in the fetched content
and did not expose libx264's own keyint default. The generic `-g 12` default is documented in
the generic codec options section.

## Key passages

- **`-g` default:** "Set the group of picture (GOP) size. Default value is 12." `[unverified-exact]`
- libx264 section present in table of contents (section 9.19) but body content was truncated;
  libx264-specific `keyint` default not confirmed from this source.

## Structural metadata

- The generic `-g 12` means: with default settings, a keyframe occurs every 12 frames.
- At 30 fps, GOP = 12 → keyframe every ~0.4 seconds; at 60 fps → every ~0.2 seconds.
- libx264's own default keyint (commonly cited as 250 frames in upstream documentation) was
  NOT confirmed from this fetched source — the page truncated before reaching section 9.19.
- This attestation confirms the generic FFmpeg default only; libx264's default may differ
  and should be treated as unverified from fetched sources.
