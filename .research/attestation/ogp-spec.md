---
source_handle: ogp-spec
fetched: 2026-06-24
source_url: https://ogp.me/
provenance: source-direct
---

# Open Graph Protocol Specification

## Paraphrased Summary

The Open Graph Protocol (OGP) enables any web page to become a rich object in a social graph. It defines a set of `<meta>` tags placed in the HTML `<head>` that social platforms and crawlers read to produce rich link previews.

## Required Properties

All OGP pages must include four mandatory tags:

- `og:title` — the object's title as it should appear in the graph
- `og:type` — the type category (e.g., `video.movie`, `article`, `website`)
- `og:image` — a URL to an image representing the object
- `og:url` — canonical URL of the object (its permanent ID in the graph)

## Optional Properties

Commonly used optional tags include:
- `og:description` — short description
- `og:site_name` — the overall site name
- `og:locale` — locale format (e.g., `en_US`)
- `og:audio`, `og:video`

## Video-Specific Properties

`og:video` supports structured sub-properties:
- `og:video` / `og:video:url` — the video URL
- `og:video:secure_url` — HTTPS alternative
- `og:video:type` — MIME type (e.g., `video/mp4`)
- `og:video:width` — pixel width
- `og:video:height` — pixel height

## Video Object Types

`og:type` values for video content:

- `video.movie` — includes `video:actor`, `video:director`, `video:writer`, `video:actor:role`, `video:duration` (integer, seconds), `video:release_date` (datetime), `video:tag` (array)
- `video.episode` — same as movie plus `video:series` (reference to a `video.tv_show`)
- `video.tv_show` — same metadata pattern as movie
- `video.other` — same metadata pattern as movie

## Key Passage

> "The Open Graph protocol enables any web page to become a rich object in a social graph."

## Structural Notes

- The protocol uses `<meta property="og:..." content="...">` syntax
- Facebook's official parser/debugger is referenced as a validation tool
- Multiple values for a tag can be specified with repeated meta elements (used for structured arrays)
