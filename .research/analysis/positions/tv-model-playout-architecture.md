---
status: settled
authored: 2026-06-10
provenance: agent-synthesis
related:
  - to: ../briefs/streaming-server-evaluation.md
    type: grounds
    note: full SRS vs MediaMTX evaluation with per-requirement scoring
  - to: ../briefs/irl-streaming.md
    type: cites
    note: SRS vs MediaMTX vs IRL-hardware considerations
  - to: srs-streaming-server.md
    type: cites
    note: operational mechanics of SRS; this record adds the comparative architectural layer
  - to: liquidsoap-playout-engine.md
    type: cites
    note: engine for the always-on channel
  - to: vidstack-media-player.md
    type: cites
    note: client-side player for multi-channel UI
  - to: pg-boss-job-queue.md
    type: cites
    note: queue hosting the FLV→MP4 remux job
revisit_if:
  - SRS upstream activity stalls (issue-response latency, release cadence, key-contributor churn)
  - LL-HLS or fMP4 becomes a platform requirement (MediaMTX's strong dimensions)
  - Simulcast forwarding reliability regresses in SRS — MediaMTX's FFmpeg-hook approach becomes comparable
  - TV model itself gets reconsidered (dropping always-on channel, or moving to peer-to-peer streaming)
---

# Position: TV model architecture — SRS vs MediaMTX comparative decision

**Status: settled.** The platform operates on a TV model with SRS as the unified multi-channel
server, selected over MediaMTX at the Phase 2/3 architectural decision point.

## The stance

**TV model + SRS** are the platform's streaming architecture.

### TV model

N channels where 1 is always-on (pre-recorded content loop via playout engine) and 0-to-X are
dynamic (one per active streamer; appear when they go live, disappear when they stop). Scheduled
programming is just another channel — same primitive as a live streamer.

This required abandoning the prior single-channel Owncast + Restreamer architecture:
- Owncast is single-channel by design — fatal for the TV model.
- Restreamer entered abandonware status December 2025 (issue #960).
- Owncast doesn't support CQP rate control on Intel UHD 630.
- Two services doing what one modern streaming server handles.

### SRS as the unified server

SRS was selected over MediaMTX on the two load-bearing requirements:

| Concern | SRS | MediaMTX | Weight |
|---|---|---|---|
| Dynamic multi-channel | Better (native) | Workable (YAML upfront, PATCH API workaround) | **High** |
| Simulcast forwarding | Native `forward` directive | Fragile `runOnReady` FFmpeg hooks | **High** |
| Auth/API integration | Built-in HTTP callbacks | External auth server required | Medium |
| HLS features | Basic (MPEG-TS only) | LL-HLS, fMP4 | Medium |
| Recording format | FLV (needs remux) | fMP4 (browser-ready) | Medium |
| Config/docs | Chinese-first, nginx-like | English-first, YAML | Low |

SRS wins on both High-weight dimensions. MediaMTX's advantages (LL-HLS, fMP4, English docs) are
real but lower-weight or addressable (FLV→MP4 remux via media-pipeline FFmpeg workers, handled
by the pg-boss job queue).

## Rejected alternatives

### Keep Owncast + Restreamer

Owncast is single-channel by design — cannot serve the TV model. Restreamer is abandonware.
Owncast's CQP limitation on UHD 630 precludes HW quality tuning. Running two services for what
one modern server provides is structural waste.

### MediaMTX (as the unified server)

Both MediaMTX and SRS are MIT-licensed, actively maintained, natively multi-channel. MediaMTX
has real advantages: Go codebase (more forkable than C++), English-first docs, YAML config,
fMP4 recording (browser-ready, no remux step), LL-HLS, half the Docker image size.

**Why rejected for the TV model:** Dynamic channels require upfront YAML config — adding a
channel is an acknowledged workaround, not a native model. Simulcast forwarding uses
`runOnReady` FFmpeg hooks with no process supervision and no reconnect handling — critical
failure mode for S/NC's no-exclusivity differentiator (reliable simulcast to Twitch/YouTube/Kick
is load-bearing). Auth requires building a separate auth server. WebRTC scales poorly (CPU
spikes with concurrent viewers), closing the low-latency interactive-features path.

**Swap-cost analysis:** Phases 1-2 had trivial swap cost (1 service file + 1 embed URL). Phase 3+
accumulates server-specific code (callback auth, webhook formats, simulcast destination
management, VOD recording pipeline). By Phase 3+, switching servers is a major rewrite. The
decision had to land at the Phase 2/3 boundary — which it did.

## What neither server provides (platform-built)

- **ABR** (adaptive bitrate): platform-level, FFmpeg sidecar, future work.
- **Chat**: platform-built (Owncast's chat goes away with the switch to SRS).
- **ActivityPub**: platform-built via Fedify (federation work).

All three need platform solutions regardless of server choice.

## Platform constraints it sets

- Platform owns playout: Liquidsoap selected as the always-on channel engine.
- Platform owns chat: landed Phase 6 as a platform-built solution.
- Database concept of channels: always-on is the special case; live channels are dynamic.
- Multi-channel UI: channel grid/selector, not a single `/live` page.
- DVR FLV format requires remux for browser playback: media-pipeline FFmpeg workers handle this
  via the pg-boss job queue.
- Production streaming mechanics (SRS callback auth, stream key, lifecycle) detailed in
  `positions/srs-streaming-server.md`.
