---
id: platform-0001
title: SRS as the unified streaming server for Phase 3+
status: active
created: 2026-03-25
updated: 2026-04-16
supersedes: []
superseded_by: null
revisit_if:
  - "SRS development stalls or governance wobbles"
  - "A new streaming server emerges that covers the TV-model requirements with materially less platform-side work"
  - "The chat/federation/VOD features we commit to building at the platform layer prove too expensive to maintain relative to what an Owncast-class server would give us"
  - "Multi-channel requirements are simplified away (TV model abandoned), making the single-channel limitation irrelevant again"
---

## Context

The architecture shifted from Owncast-centric (Phases 1-2) to a TV model for Phase 3+ — an always-on playout channel plus dynamic live channels that appear when creators go live. This requires multi-channel support Owncast cannot provide (single-channel by design). Restreamer's development paused in December 2025, introducing abandonware risk on the simulcast component we relied on. A unified replacement is needed before Phase 3 implementation begins.

## Alternatives considered

### Owncast + Restreamer (status quo)

**Why considered.** Working system in Phases 1-2. Free chat, free ActivityPub go-live, mature HLS output, familiar operational surface.

**Why rejected.**
- Single-channel by design — fatal for the TV model (cannot run always-on playout alongside dynamic live channels)
- Restreamer development paused December 2025 — abandonware risk on the simulcast component
- No CQP rate control on Intel UHD 630 low-power encoder
- No path to low-latency (WebRTC) or DVR

**Would change our mind if.** The TV model is abandoned and we revert to single-channel + external simulcast. Restreamer development resuming would help with one failure mode but doesn't solve the multi-channel fatal flaw.

### MediaMTX

**Why considered.** Go codebase (more forkable than C++), English-first docs, YAML config, OpenAPI spec, fMP4 recording (browser-ready, crash-safe, no remux step), half the Docker image size of SRS, LL-HLS support, native SRT ingest, strong DX overall.

**Why rejected.**
- Simulcast forwarding is fragile (`runOnReady` FFmpeg hooks, no process supervision, no reconnect handling) — critical failure mode for S/NC's no-exclusivity differentiator (reliable simulcast to Twitch/YouTube/Kick is load-bearing)
- Dynamic channels are workarounds, not native — path model wants upfront YAML config; PATCH API is a workaround
- Auth requires building a separate auth server — more code to build and maintain
- WebRTC scales poorly (CPU spikes with concurrent viewers) — closes the low-latency interactive features path
- Single primary maintainer (bus factor), though `bluenviron` org transfer mitigates

**Would change our mind if.** Simulcast forwarding lands as a first-class reliable feature (not fragile hooks); OR if we decide fMP4 recording + LL-HLS + Go forkability outweigh the simulcast/dynamic-channel/auth/WebRTC weaknesses.

## Decision

**SRS (Simple Realtime Server) — MIT license, C++, 28.7k GitHub stars, 11 maintainers, 10+ years of development** — replaces both Owncast and Restreamer as a single unified streaming server for Phase 3+. SRS handles ingest (RTMP + SRT native), HLS output, multi-destination forwarding, DVR recording, and auth callbacks. Phases 1-2 stay on Owncast + Restreamer until Phase 3 implementation begins — the swap happens at the Phase 2→3 boundary.

Primary reasons:

1. **Native multi-channel** — core TV model requirement, no workarounds needed
2. **Native simulcast forwarding** — reliable `forward` directive, production-grade, no FFmpeg hook fragility
3. **Mature WebRTC (WHIP/WHEP)** — clear path to low-latency interactive features (polls, predictions, Q&A, channel points) with competitive parity against Twitch/YouTube
4. **Native DVR subsystem** — enables both VOD recording and live rewind (YouTube-style differentiator vs Twitch's auto-delete)
5. **Built-in HTTP callback auth** (`on_publish` / `on_play`) — fits multi-creator stream key rotation without building an external auth server
6. **Native SRT ingest** (`srt_to_rtmp`) — eliminates FFmpeg SRT→RTMP bridge in the IRL pipeline's SRTLA relay LXC

Weighted scoring across 20 requirements: SRS 101, MediaMTX 63, Owncast + Restreamer 32. See [streaming-server-evaluation.md](../../.memory/research/streaming-server-evaluation.md) §Scoring Matrix for the per-requirement breakdown and §Competitive Feature Impact for how each option positions S/NC against Twitch, YouTube Live, and Kick.

## Consequences

**Enabled:**
- Multi-channel TV model (always-on playout + N dynamic live channels)
- Reliable simulcast to Twitch / YouTube / Kick — core to S/NC's no-exclusivity differentiator (Twitch Affiliates cannot simulcast; S/NC creators can)
- Live rewind (YouTube-style) via native DVR
- Low-latency interactive features path via WebRTC
- Clip creation via DVR + timestamp access
- Co-streaming naturally supported (multi-channel is native)
- Premieres via playout publishing to an SRS channel (same as any other ingest)
- VOD as premium (persistent recordings behind subscription paywall vs Twitch auto-delete)

**Platform-side work required** (was free with Owncast):
- **Chat** as a platform feature: WebSocket chat with patron badges, emotes, moderation tools, platform-native identity
- **ActivityPub go-live notifications** via Fedify, already planned in the federation roadmap
- **VOD recording pipeline**: SRS DVR (FLV) → media-pipeline job (pg-boss queue) → MP4 faststart via `ffmpeg -c copy` remux → Garage S3

**Accepted trade-offs:**
- FLV recording format requires `ffmpeg -c copy` remux to MP4. Handled by the media-pipeline FFmpeg service + pg-boss job queue. Zero re-encoding, completes in seconds. Webhook-triggered post-process upload to Garage.
- Chinese-first documentation. English docs exist and SRS has extensive examples; operational `srs-console` web admin UI mitigates doc gaps for debugging.
- nginx-like config format (not YAML). Less readable than YAML but well-documented and version-controllable.
- C++ codebase is less forkable than Go, but 11 active maintainers reduces bus factor meaningfully.

## Related

- [../../.memory/research/streaming-server-evaluation.md](../../.memory/research/streaming-server-evaluation.md) — full evaluation, requirement weighting, scoring matrix, competitive analysis
- [../../.memory/research/streaming-infrastructure.md](../../.memory/research/streaming-infrastructure.md) — original streaming tool research that motivated the evaluation
- [../../.memory/research/irl-streaming.md](../../.memory/research/irl-streaming.md) — SRS vs MediaMTX comparison tables and IRL streaming architecture
- TV model architecture design doc — in the parent monorepo under `boards/platform/release-0.2/design/tv-model-architecture.md` (prose reference to preserve standalone cloning)
- Competitive streaming research — in the parent monorepo under `org/.memory/research/competitive/streaming.md` (prose reference)
- Streaming board — in the parent monorepo under `boards/platform/streaming/` (prose reference)

Supersedes the prior `boards/platform/streaming/DECISIONS.md` entry dated 2026-03-25. Content promoted from the board-directory decision convention into the structured decision record format as Item 3a of the Level 3 critical path (2026-04-16). No position change from the 2026-03-25 decision — this is a format migration, not a reversal.
