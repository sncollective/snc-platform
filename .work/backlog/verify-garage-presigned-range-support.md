---
id: verify-garage-presigned-range-support
kind: story
tags: [media-pipeline]
parent: null
depends_on: []
release_binding: null
gate_origin: null
research_origin: video-production-media-hub
created: 2026-06-23
updated: 2026-06-23
---

# Verify Garage presigned-URL Range-request support

Confirm whether a Garage presigned GET URL returns an HTTP Range-capable response
(`Accept-Ranges: bytes` / `206 Partial Content` with `Content-Range` on a `Range:` request).

**Why it's tracked:** the pivotal input to the still-open media-access architecture decision (see
the `video-editor-integration` position §Open). Garage's docs list `GetObject` as implemented but
are **silent on Range**. If presigned GETs honor Range, the **through-Caddy HTTP media path**
becomes viable for editing/render — no direct storage mount, no hole punched through the network
perimeter; if not, the mount / cloud-workstation options carry more weight.

## How to verify

Run against **prod Garage on the Proxmox host** (dev may differ in version/config). Three layers,
each isolating a failure point:

1. **Garage itself honors Range:**
   `aws --endpoint-url <garage> s3api get-object --bucket <b> --key <video-key> --range "bytes=0-99" /tmp/r.bin`
   — PASS if the response JSON shows `AcceptRanges: bytes` + `ContentRange: bytes 0-99/<total>`
   and `/tmp/r.bin` is exactly **100 bytes**; FAIL if it returns the whole object.
2. **The full chain (redirect endpoint + Caddy) preserves Range:**
   `curl -s -L -D - -o /dev/null -H "Range: bytes=0-99" "https://<platform>/media/<id>/stream"`
   — PASS if the final response is `206` with `Content-Range`/`Accept-Ranges`. Also reveals
   whether the 302 hands bytes off to Garage directly (Caddy out of the byte path) vs. stays
   Caddy-fronted.
3. **The real consumer seeks:**
   `time ffmpeg -ss 600 -i "<url>" -frames:v 1 -f null -` (fast + little data pulled = Range seek),
   and the exact melt in-point case `melt "<url>" in=600 out=700 -consumer avformat:/tmp/out.mp4`
   (in-point honored = Range works; ignored / whole-file buffered = the MLT HTTP-stream limitation).

**Gotcha:** test with an MP4 whose `moov` atom is at the **end** (not `+faststart`) — a faststart
file gives a false pass. Presign for **GET** (a HEAD against a GET-signed URL fails the signature);
use **path-style** addressing for Garage.

## Research grounding

**Source**: `.research/analysis/campaigns/video-production-media-hub/parent.md` (slug: `video-production-media-hub`); settled-stance home: `.research/analysis/positions/video-editor-integration.md`

The campaign's load-bearing open question — the `qualifies` tension between the editor-integration
and infra/render-backends facets turns on whether Garage honors Range.
