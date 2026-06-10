---
status: settled
authored: 2026-06-10
provenance: agent-synthesis
related:
  - to: ../briefs/streaming-server-evaluation.md
    type: grounds
    note: full evaluation; 20-requirement weighted scoring matrix and competitive analysis
  - to: ../briefs/streaming-infrastructure.md
    type: grounds
    note: original streaming tool research that motivated the evaluation
  - to: ../briefs/irl-streaming.md
    type: cites
    note: SRS vs MediaMTX comparison tables and IRL streaming architecture
revisit_if:
  - SRS development stalls or governance wobbles (issue-response latency, release cadence, key-contributor churn)
  - A new streaming server emerges that covers the TV-model requirements with materially less platform-side work
  - The chat/federation/VOD features we commit to building at the platform layer prove too expensive to maintain relative to what an Owncast-class server would give us
  - Multi-channel requirements are simplified away (TV model abandoned), making the single-channel limitation irrelevant again
---

# Position: SRS as the unified streaming server

**Status: settled.** SRS replaces both Owncast and Restreamer as the platform's unified streaming
server from Phase 3+, selected after a full weighted evaluation of the available options.

## The stance

**SRS (Simple Realtime Server — MIT, C++, 28.7k GitHub stars, 11 maintainers, 10+ years) is the
platform's streaming server.** It handles ingest (RTMP + SRT native), HLS output,
multi-destination forwarding, DVR recording, and auth callbacks. Phases 1-2 operated on
Owncast + Restreamer; the swap occurred at the Phase 2→3 boundary.

### Why SRS wins on the two load-bearing requirements

**Multi-channel** (TV-model requirement — fatal without it): SRS is natively multi-channel.
Owncast is single-channel by design. MediaMTX supports multiple channels but path management
requires upfront YAML config; dynamic channels are a workaround, not a native model.

**Simulcast forwarding reliability** (S/NC's no-exclusivity differentiator — Twitch Affiliates
cannot simulcast, S/NC creators can): SRS ships a `forward` directive that is production-grade
and process-supervised. MediaMTX relies on `runOnReady` FFmpeg hooks with no process supervision
and no reconnect handling — fragile in exactly the failure mode that matters most.

### Additional advantages

- Native WebRTC (WHIP/WHEP): clear path to low-latency interactive features (polls,
  predictions, Q&A) with competitive parity against Twitch/YouTube.
- Native DVR subsystem: enables both VOD recording and live rewind (a YouTube-style
  differentiator vs Twitch's auto-delete).
- Built-in HTTP callback auth (`on_publish` / `on_play`): multi-creator stream key rotation
  without building an external auth server.
- Native SRT ingest (`srt_to_rtmp`): eliminates the FFmpeg SRT→RTMP bridge in the IRL
  pipeline's SRTLA relay.

Weighted scoring across 20 requirements: SRS 101, MediaMTX 63, Owncast + Restreamer 32.

## Rejected alternatives

### Owncast + Restreamer (status quo at Phase 2)

- **Single-channel by design** — fatal for the TV model. No workaround path.
- **Restreamer development paused** December 2025: abandonware risk on the simulcast
  component that was the entire reason for the two-server architecture.
- No CQP rate control on Intel UHD 630 low-power encoder.
- No path to low-latency (WebRTC) or DVR.

Would reconsider if: the TV model is abandoned and we revert to single-channel + external
simulcast. Restreamer resuming development would not resolve the single-channel fatal flaw.

### MediaMTX

Go codebase (more forkable than C++), English-first docs, YAML config, OpenAPI spec, fMP4
recording (browser-ready, no remux step), half the Docker image size of SRS, LL-HLS, native
SRT ingest.

**Why rejected:** Simulcast forwarding is the critical failure mode: `runOnReady` FFmpeg hooks
have no process supervision and no reconnect handling — reliable simulcast to Twitch/YouTube/Kick
is load-bearing (S/NC's no-exclusivity differentiator) and MediaMTX cannot be trusted there. Dynamic
channels require upfront YAML config; PATCH API is an acknowledged workaround. Auth requires
building a separate auth server. WebRTC CPU spikes with concurrent viewers, closing the
low-latency interactive-features path. Single primary maintainer (bus factor), though `bluenviron`
org transfer mitigates.

Would reconsider if: simulcast forwarding lands as a first-class reliable feature (not fragile
hooks), or if fMP4 recording + LL-HLS + Go forkability outweigh the simulcast/dynamic-channel/
auth/WebRTC weaknesses.

## Accepted trade-offs

- **FLV recording format** requires `ffmpeg -c copy` remux to MP4. Handled by the
  media-pipeline FFmpeg service + pg-boss job queue (`positions/pg-boss-job-queue.md`);
  zero re-encoding, completes in seconds.
- **Chinese-first documentation.** English docs exist; `srs-console` admin UI mitigates for
  debugging.
- **nginx-like config format** (not YAML). Less readable but well-documented.
- **C++ codebase** is less forkable than Go, but 11 active maintainers reduce bus factor.

## Platform constraints it sets

- `srs-v6` tech-reference skill carries the SRS API and operational patterns.
- Playout engine (Liquidsoap) publishes RTMP to SRS on `/live/channel-main`.
- VOD pipeline: SRS DVR (FLV) → pg-boss queued remux job → MP4 faststart → Garage S3.
- SRS callback auth (`on_publish` / `on_play`) governs stream key rotation for multi-creator
  live streams.
