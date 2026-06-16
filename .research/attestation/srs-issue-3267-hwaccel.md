---
source_handle: srs-issue-3267-hwaccel
source_class: github-readme
fetched: 2026-06-16
source_url: https://github.com/ossrs/srs/issues/3267
provenance: source-direct
substrate_confidence: search-summary
tool: SRS GitHub issue #3267 — hardware acceleration in transcoding
version: discussion against SRS 4 (issue closed Won't-fix)
topic: SRS transcode restricted to libx264; h264_nvenc errors; hardware encode not supported in-engine
---

# SRS GitHub issue #3267 — hardware acceleration in transcoding

Engagement note: WebFetch summary of the issue page. The reporter's problem statement is
captured; no substantive maintainer reply text was surfaced in the summary beyond the issue's
labels/status. Treat the "Won't fix" disposition as the load-bearing signal.

## Paraphrased summary

A user reports that SRS's built-in transcode restricts the ffmpeg video encoder to `libx264`
and does not enable GPU hardware acceleration; setting `vcodec h264_nvenc` produces an error.
The user asks for the rationale and for a way to use hardware acceleration via external ffmpeg.
The issue is **filed against SRS 4**, is **Closed**, and is labeled **Codec / Discussion /
Won't fix**. The summary did not surface a maintainer's written rationale, but the Won't-fix
disposition indicates SRS's in-engine transcode is not the place hardware encoding is
supported. The implied path (and the user's own question) is to do hardware-accelerated
encoding in an **external ffmpeg** process rather than via SRS's `transcode` block.

## Key passages

- Reporter: SRS "restricts the video encoder to libx264 and does not enable GPU hardware
  acceleration. When attempting to use h264_nvenc, an error occurs." `[unverified-exact]`
- Reporter asks "if there is a way to enable hardware acceleration for external FFMPEG."
- Issue metadata: **Version SRS 4; Status Closed; Labels: Codec, Discussion, Won't fix.**

## Disconfirming note

This is an SRS-4-era report. It is the clearest signal found that SRS's *in-engine* transcode
does not support hardware encoders, but it does NOT prove the SRS 6 transcode block forbids
passing an arbitrary `vcodec` to ffmpeg in all cases — only that hardware accel via the
transcode block was reported broken and Won't-fixed. The robust reading: do not rely on SRS's
transcode block for VAAPI/NVENC; an external ffmpeg (or the upstream Liquidsoap encoder)
remains the supported place to choose the encoder. Cross-checked against `srs-fullconf-source`,
whose documented `vcodec` value list (libx264/copy/png/vn) does not include hardware encoders.

## Structural metadata

- GitHub issue on ossrs/srs. Won't-fix is a maintainer disposition, not a transient state.
- The constraint scopes SRS's transcode feature, not ffmpeg generally — ffmpeg itself supports
  VAAPI/NVENC; the question is whether SRS will drive it, and the answer is "not in-engine."
