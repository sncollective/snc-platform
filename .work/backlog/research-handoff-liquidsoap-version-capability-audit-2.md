---
id: research-handoff-liquidsoap-version-capability-audit-2
tags: [research, streaming, media-pipeline]
release_binding: null
research_origin: liquidsoap-version-capability-audit
created: 2026-06-16
---

# Spike: does `h264_vaapi` work in Liquidsoap's `%ffmpeg` encoder on 2.4.x?

A focused feasibility spike. Determines whether the VAAPI hardware-encoding requirement (Intel UHD
630 / i7-10700, CQP — from prior playout research) can be met **upstream in Liquidsoap's `%ffmpeg`
encoder**, or whether it needs a dedicated ffmpeg sidecar (as the `streaming-abr-transcoding-strategy`
backlog item proposes).

This is the one open LS-side question the version/capability audit could not close. It is **not**
an SRS question — the audit established SRS transcode is software-`libx264`-only (issue #3267
Won't-fix), so VAAPI must live upstream of SRS. The remaining question is *which* upstream: the
Liquidsoap encoder, or a separate ffmpeg process.

## Sketch

- Test a throwaway Liquidsoap container with `%ffmpeg(format="flv", %video(codec="h264_vaapi", …))`
  against the dev hardware (or confirm the dev container lacks `/dev/dri` and the spike must run on
  target hardware). Does Liquidsoap's ffmpeg binding accept the VAAPI encoder + the device/hwupload
  filter chain?
- Not blocking until ABR/multi-rendition work is scoped; park until then.

## Research grounding

**Source**: `.research/analysis/campaigns/liquidsoap-version-capability-audit/parent.md`
(slug: `liquidsoap-version-capability-audit`)

Carried open question from the §VAAPI/ABR finding: "encode outside SRS" is settled; whether
`h264_vaapi` works in Liquidsoap's `%ffmpeg` encoder vs needs a sidecar is the de-risking spike.
