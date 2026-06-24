---
source_handle: rfc7233-range-requests
fetched: 2026-06-24
source_url: https://www.rfc-editor.org/rfc/rfc7233
provenance: source-direct
---

# RFC 7233 — HTTP Range Requests

## Paraphrased Summary

RFC 7233 defines the HTTP range request mechanism that enables clients to request specific byte ranges of a resource, which underlies video seeking behavior in browsers.

## How Range Requests Work

"HTTP clients often encounter interrupted data transfers as a result of canceled requests or dropped connections." Range requests allow efficient recovery by fetching only missing portions.

## The Range Header

Clients use the `Range` header:
- `bytes=0-499` — first 500 bytes
- `bytes=500-999` — second 500 bytes
- `bytes=-500` — last 500 bytes

"Byte offsets start at zero" and positions are inclusive.

## 206 Partial Content Response

Server responds with HTTP 206 when supporting range requests:
- Single range: `Content-Range` header specifies which bytes are included
- Multiple ranges: multipart response with per-part `Content-Range` headers

## Video Seeking Application

From MDN documentation on the same mechanism: When users scrub a video progress bar, the browser calculates target byte position based on timestamp and file duration, then sends a Range request for just the needed segment. Server advertises support via `Accept-Ranges: bytes`.

Status codes:
- `206` — successful range request
- `416` — requested range out of bounds
- `200` — no range support (full file sent)

## Key Passages

> "Byte offsets start at zero" and positions are inclusive.

> RFC 7233 enables "browsers to jump to specific timestamps without downloading the entire video."
