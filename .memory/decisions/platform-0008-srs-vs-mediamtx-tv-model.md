---
id: platform-0008
title: TV model architecture — SRS vs MediaMTX comparative decision
status: active
created: 2026-03-25
updated: 2026-04-18
supersedes: []
superseded_by: null
revisit_if:
  - "SRS upstream activity stalls (issue-response latency, release cadence, key-contributor churn)"
  - "LL-HLS or fMP4 becomes a platform requirement (MediaMTX's strong dimensions)"
  - "Simulcast forwarding reliability regresses in SRS — MediaMTX's FFmpeg-hook approach becomes comparable"
  - "TV model itself gets reconsidered (dropping always-on channel, or moving to peer-to-peer streaming)"
---

## Context

Two architectural decisions landed together in early 2026 during the Owncast-to-SRS transition: **(1) TV model shift** from single-channel to an N-channel architecture, and **(2) streaming server replacement** of the Owncast + Restreamer stack with a single unified multi-channel server.

Single-channel pain: Owncast serves one stream at a time; creators rotate through a shared stream key. Restreamer (simulcast forwarder) entered abandonware status Dec 2025 (issue #960). Owncast doesn't support CQP rate-control on Intel UHD 630 — no HW quality tuning. Two services doing what one modern streaming server handles.

## Decision

**TV model.** N channels where 1 is always-on (pre-recorded content loop via playout engine) and 0-to-X are dynamic (one per active streamer; appear when they go live, disappear when they stop). Scheduled programming is just another channel — same primitive as a live streamer.

**SRS** selected as the unified multi-channel server replacing Owncast + Restreamer. Native multi-channel, native multi-destination forwarding, built-in HTTP callback auth, dynamic stream lifecycle via HTTP API.

## Alternatives considered

### Keep Owncast + Restreamer (rejected)

Owncast is single-channel by design — cannot serve TV model. Restreamer is abandonware. Owncast's CQP limitation on UHD 630 precludes HW quality tuning. Running two services for what one modern server provides is structural waste.

### MediaMTX (considered, rejected for TV model)

Both MediaMTX and SRS are MIT-licensed, actively maintained, natively multi-channel.

| Concern | SRS | MediaMTX | Weight |
|---|---|---|---|
| Dynamic multi-channel | Better | Workable (YAML upfront) | **High** |
| Simulcast forwarding | Native `forward` directive | Fragile `runOnReady` FFmpeg hooks | **High** |
| Auth/API integration | Built-in HTTP callbacks | External auth server required | Medium |
| HLS features | Basic (MPEG-TS only) | LL-HLS, fMP4 | Medium |
| Recording format | FLV (needs remux) | fMP4 (browser-ready) | Medium |
| Config/docs | Chinese-first, nginx-like | English-first, YAML | Low |

SRS wins on the two High-weight dimensions. MediaMTX's advantages (LL-HLS, fMP4, English docs) are real but lower-weight or addressable (FLV→MP4 remux via the media-pipeline FFmpeg workers).

**Swap-cost analysis.** Phases 1-2 of the streaming rollout had trivial swap cost (1 service file + 1 embed URL). Phase 3+ accumulates server-specific code (callback auth, webhook formats, simulcast destination management, VOD recording pipeline). By Phase 3+, switching servers is a major rewrite. The decision had to land at the Phase 2/3 boundary — which it did.

### Neither server provides

- **ABR** (adaptive bitrate) — platform-level, FFmpeg sidecar, future work
- **Chat** — platform-built (Owncast's chat goes away)
- **ActivityPub** — platform-built via Fedify (federation work)

All three need platform solutions regardless of server choice.

## Consequences

- Platform owns playout (Liquidsoap selected — see [platform-0009](platform-0009-liquidsoap-playout-engine.md))
- Platform owns chat (landed Phase 6 as platform-built solution)
- Database concept of channels (always-on is the special case, live channels are dynamic)
- Multi-channel UI (channel grid/selector, not a single `/live` page)
- DVR FLV format needs remux for browser playback (media-pipeline FFmpeg workers handle — see [platform-0003](platform-0003-pg-boss-postgres-job-queue.md))
- Production streaming mechanics (SRS callback auth, stream key, lifecycle) live in [platform-0001](platform-0001-srs-unified-streaming-server.md) as operational detail

## Related

- [platform-0001-srs-unified-streaming-server.md](platform-0001-srs-unified-streaming-server.md) — operational mechanics of SRS; this record adds the comparative/architectural layer platform-0001 assumed.
- [platform-0009-liquidsoap-playout-engine.md](platform-0009-liquidsoap-playout-engine.md) — engine for the always-on channel.
- [platform-0004-vidstack-media-player.md](platform-0004-vidstack-media-player.md) — client-side player for multi-channel UI.
- [platform-0003-pg-boss-postgres-job-queue.md](platform-0003-pg-boss-postgres-job-queue.md) — queue hosting the FLV→MP4 remux job.
- `platform/.memory/research/streaming-server-evaluation.md` — full SRS vs MediaMTX evaluation.
- `platform/.memory/research/irl-streaming.md` — SRS vs MediaMTX vs IRL-hardware considerations.

Promoted 2026-04-18 during boards-migration story 1 from `boards/platform/release-0.2/design/tv-model-architecture.md`.
