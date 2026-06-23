---
source_handle: ffmpeg-http-redirect
fetched: 2026-06-23
source_url: https://github.com/FFmpeg/FFmpeg/blob/master/libavformat/http.c
provenance: source-direct
---

## Summary

FFmpeg's HTTP protocol implementation in `libavformat/http.c` handles HTTP redirects natively and automatically. The implementation covers 301, 302, 303, 307, and 308 status codes.

## Key passages

**MAX_REDIRECTS constant:**
`#define MAX_REDIRECTS 8`

FFmpeg enforces a maximum redirect depth of 8 to prevent infinite loops.

**Redirect-following implementation:**
In `http_open_cnx()`, when the response code matches `301 || 302 || 303 || 307 || 308` and `s->new_location` is set (i.e., a Location header was received), the function closes the current connection, increments the redirect counter, caches the redirect information, updates the location, and restarts authentication. This is automatic — no caller-visible option is needed to activate it.

**AVOption for redirect control:**
```
{ "max_redirects", "Maximum number of redirects", OFFSET(max_redirects), AV_OPT_TYPE_INT, { .i64 = MAX_REDIRECTS }, 0, INT_MAX, D }
```

There is **no** `follow_redirect` toggle — redirect following is unconditional at the HTTP protocol level. The only configurable aspect is the maximum count (`max_redirects`), which defaults to 8.

**Implication for the platform's redirect endpoint pattern:**
The platform's `/media/{id}/stream` endpoint issues an HTTP 302 redirect to a presigned S3 URL. FFmpeg (and by extension `melt`/MLT's avformat producer) will follow this redirect automatically when any `http://` or `https://` URL is used as a media source. No special configuration is needed.

## Structural metadata

- Type: source code
- Scope: FFmpeg libavformat HTTP protocol implementation
- Relevant to: `melt` HTTP URL inputs, MLT avformat producer network media access
