---
source_handle: facebook-og-sharing
fetched: 2026-06-24
source_url: https://developers.facebook.com/docs/sharing/webmasters/
provenance: source-direct
---

# Facebook Open Graph Sharing Documentation

## Paraphrased Summary

Meta/Facebook's developer documentation for sharing web content via Open Graph, with specific requirements for video content that can play inline in the Facebook Feed.

## Required Tags (All Content)

- `og:url` — canonical URL for the page
- `og:title` — title without branding
- `og:description` — brief description, "usually between 2 and 4 sentences"
- `og:image` — preview image when shared

## Video-Specific Requirements

For video to play inline in Feed:

- `og:video` or `og:video:url` — video location
- `og:video:secure_url` — HTTPS version; **required** "to make your video eligible to play in-line in Feed"
- `og:video:type` — either `application/x-shockwave-flash` or `video/mp4`
- `og:video:width` — "Required for videos"
- `og:video:height` — "Required for videos"

## Image/Thumbnail Requirements

- `og:image` specifies the high-quality preview image
- `og:image:width` and `og:image:height` should be included "to ensure that the image loads properly the first time it's shared"
- Recommended minimum width: 1080 pixels; minimum 600 pixels
- Aspect ratio options: 1.91:1 (e.g., 1200x630) or 1:1 square

## Caching

- Pre-caching via URL Sharing Debugger tool recommended to pre-fetch metadata before organic sharing

## Key Passage

> "Use og:video:secure_url to make your video eligible to play in-line in Feed"
