---
source_handle: google-structured-data-video
fetched: 2026-06-24
source_url: https://developers.google.com/search/docs/appearance/structured-data/video
provenance: source-direct
---

# Google Search — Video Structured Data Requirements

## Paraphrased Summary

Google's structured data documentation specifies how to mark up VideoObject schema to qualify for rich results in Google Search, including video carousels and key-moment (clip) markup.

## Required VideoObject Properties

Three properties are mandatory for Google Search eligibility:

1. **name** — "The title of the video. Make sure to use unique text in the `name` property for each video on your site."
2. **thumbnailUrl** — "A URL pointing to the video's unique thumbnail image file."
3. **uploadDate** — "The date and time the video was first published, in ISO 8601 format."

## Recommended Properties

- **contentUrl** or **embedUrl** — "The most effective way for Google to fetch your video content files."
- **description** — unique text describing video content
- **duration** — ISO 8601 format (e.g., `PT1M54S`)
- **interactionStatistic** — view counts via InteractionCounter
- **regionsAllowed** / **ineligibleRegion** — geographic restrictions
- **expires** — when the video becomes unavailable

## Thumbnail Requirements

- Multiple URLs in different aspect ratios supported (1×1, 4×3, 16×9)
- Must follow Google's thumbnail image guidelines

## Clip-Specific / Key Moments Markup

For marking specific segments within a video (Clip type):
- **name** — descriptive clip title
- **startOffset** — start time in seconds
- **url** — link pointing to that timestamp
- **endOffset** — (recommended) end time in seconds

Constraint: "Make sure that no two clips on the same video defined on the same page share a start time."

## Key Passage

> "The most effective way for Google to fetch your video content files" is to provide `contentUrl` or `embedUrl`.
