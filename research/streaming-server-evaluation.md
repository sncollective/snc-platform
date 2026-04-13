# Streaming Server Evaluation: SRS vs MediaMTX vs Owncast + Restreamer

**Status:** Complete — SRS selected
**Date:** 2026-03-25
**Decision record:** `boards/platform/s-nc-tv/DECISIONS.md`

Formal evaluation of streaming server options for S-NC.tv Phase 3+. Synthesizes research from `streaming-infrastructure.md`, `irl-streaming.md`, `boards/platform/s-nc-tv/design/tv-model-architecture.md`, and competitive analysis from `../../docs/research/competitive/streaming.md`.

**Context:** S-NC.tv Phases 1-2 shipped with Owncast (HLS streaming + chat + ActivityPub) + Restreamer (multi-destination relay). The architecture is shifting to a TV model (always-on playout channel + dynamic live channels) that requires multi-channel support. Owncast is single-channel by design. Restreamer development paused Dec 2025. A unified replacement is needed before Phase 3.

---

## Requirements

Weighted by strategic importance to S/NC's trajectory, informed by the feature backlog and competitive landscape (Twitch, YouTube Live, Kick).

### Critical — TV model viability

| Requirement | Why |
|-------------|-----|
| **Multi-channel support** | Always-on playout + N dynamic live channels appearing/disappearing. Core to the TV model. |
| **Dynamic stream lifecycle** | Channels created/destroyed via API without config reloads or restarts. |
| **Simulcast forwarding** | Reliable RTMP push to Twitch/YouTube/Kick. No-exclusivity is a key S/NC differentiator (competitive research: all three competitors lock creators in; S/NC doesn't). |

### High — Phase 3-6 needs + competitive table-stakes

| Requirement | Why |
|-------------|-----|
| **Auth integration** | Per-creator stream key validation, multi-creator scheduling with key rotation. |
| **Recording/DVR** | VOD pipeline foundation. Live = public reach, VOD = premium. Competitive advantage over Twitch's 14-60 day auto-delete. |
| **Webhook/callback system** | Stream start/stop events for notifications, recording triggers, scheduling. |
| **Stats API** | Stream health monitoring (bitrate, dropped frames, viewer count). Table-stakes per Twitch/YouTube. |
| **SRT native ingest** | IRL streaming pipeline — eliminates ffmpeg bridge from SRTLA relay LXC. |

### Medium — Growth & future competitive parity

| Requirement | Why |
|-------------|-----|
| **Low-latency (WebRTC)** | Interactive features: polls, predictions, Q&A, live auctions. Twitch has low-latency mode; YouTube has ultra-low latency. |
| **HLS quality** | LL-HLS, fMP4 vs MPEG-TS. Better HLS = lower perceived latency for viewers. |
| **Recording format** | Browser-ready (fMP4) vs needs remux (FLV). Affects VOD pipeline complexity and time-to-publish. |
| **Clip creation** | Timestamp-accurate stream access for clip extraction. Twitch clips and YouTube clips are table-stakes for discovery. |
| **DVR/rewind** | YouTube offers live rewind; Twitch doesn't. Differentiator if supported natively. |
| **Multi-camera/co-streaming** | Multiple simultaneous ingest streams (Twitch Squad Stream). Requires multi-channel awareness. |
| **Premiere support** | Scheduled VOD playback with live chat (YouTube Premieres). Enabled by playout system. |
| **ABR transcoding path** | Neither server does adaptive bitrate natively. Which integrates better with FFmpeg sidecar? |

### Low — Operational convenience

| Requirement | Why |
|-------------|-----|
| Config format / docs language | Developer experience, not architectural. |
| Docker image size | 24.5MB vs 49MB — marginal. |
| Web admin UI | Debugging aid, not primary interface. |
| Codebase language | Go vs C++ forkability — matters only if upstream dies. |

### Server-agnostic (platform-level regardless of choice)

No streaming server provides these — all must be built at the platform layer:
- Chat (real-time text, moderation, emotes, patron badges)
- ABR transcoding (FFmpeg sidecar)
- ActivityPub go-live notifications (was free with Owncast)
- Engagement features (channel points, polls, predictions, reactions)
- Carbon accounting for streaming infrastructure

---

## Option A: Stay with Owncast + Restreamer

**Verdict: Not viable for Phase 3+.**

| Requirement | Rating | Notes |
|-------------|--------|-------|
| Multi-channel | **Fail** | Single-channel by design. Cannot run playout + live channels simultaneously. |
| Dynamic lifecycle | **Fail** | One stream key, one channel. No API for channel management. |
| Simulcast | **Pass** | Restreamer handles this — but development paused Dec 2025. |
| Auth | **Weak** | Single static stream key. Multi-creator requires application-layer key rotation. |
| Recording | **Weak** | No native recording. Depends on Restreamer Core API (abandonware risk). |
| Webhooks | **Pass** | 7 webhook types. Sufficient for Phase 3-4. |
| Stats | **Pass** | Viewer count, stream status via REST API. |
| SRT ingest | **Fail** | RTMP only. IRL pipeline requires ffmpeg SRT→RTMP bridge. |
| Low-latency | **Fail** | HLS only (10-30s latency). No WebRTC path. |
| HLS quality | **Pass** | Adaptive bitrate HLS with multiple quality variants. |
| DVR/rewind | **Fail** | No DVR subsystem. |
| Clips | **Fail** | No recording = no clip extraction. |

**Fatal flaws:** Cannot support the TV model (single-channel), Restreamer is abandonware, no CQP rate control on Intel UHD 630 (low-power encoder), no path to low-latency or DVR. Staying with Owncast means abandoning the TV model, off-air programming, and multi-creator dynamic channels — features central to the S-NC.tv roadmap.

---

## Option B: SRS

[SRS (Simple Realtime Server)](https://github.com/ossrs/srs) — MIT license, C++, 28.7k GitHub stars, 11 maintainers, 10+ years, monthly beta releases, annual stable releases. Latest: v6.0-r0 (2025-12-03).

| Requirement | Rating | Notes |
|-------------|--------|-------|
| Multi-channel | **Native** | HTTP API creates/destroys streams dynamically. Each publish to a unique app/stream path is a channel. |
| Dynamic lifecycle | **Native** | No config reload needed. Streams appear on publish, disappear on disconnect. |
| Simulcast | **Native** | `forward` directive pushes RTMP to multiple destinations. HTTP backend can return dynamic URL lists. |
| Auth | **Built-in** | `on_publish`/`on_play` HTTP callbacks. Platform API validates stream keys, returns allow/deny. |
| Recording | **Native DVR** | DVR subsystem records to FLV. Session-based or time-segmented plans. `on_dvr` callback on segment completion. |
| Webhooks | **Rich** | `on_connect`, `on_publish`, `on_unpublish`, `on_play`, `on_dvr`, `on_hls` — 6+ callback types. |
| Stats | **Rich** | Per-stream bitrate, latency, client counts, connection details via HTTP API. |
| SRT ingest | **Native** | `srt_to_rtmp` directive. Extensive tuning (recvlatency, peerlatency, tsbpdmode, buffer sizes). |
| Low-latency | **Mature WebRTC** | WHIP/WHEP support. Sub-second latency. Proven at scale. |
| HLS quality | **Basic** | MPEG-TS segments only. No LL-HLS, no fMP4. |
| Recording format | **FLV** | Needs `ffmpeg -c copy` remux to MP4 for browser playback. Zero re-encoding, handled by media-pipeline job queue. |
| DVR/rewind | **Native** | DVR subsystem enables live rewind (YouTube-style). |
| Clips | **Enabled** | DVR + timestamp access allows clip extraction from recorded sessions. |
| Co-streaming | **Natural** | Multi-channel is native. Multiple creators publish to different stream paths simultaneously. |
| Premieres | **Natural** | Playout system publishes pre-recorded content to an SRS channel. Same as any other ingest. |
| ABR path | **Clean** | FFmpeg sidecar reads SRS output, transcodes to multiple qualities, publishes back. Well-documented pattern. |
| Config/docs | **Weak** | Chinese-first documentation. nginx-like config format (not YAML). |
| Image size | **49MB** | Larger than MediaMTX but still lightweight. |
| Admin UI | **Yes** | `srs-console` web dashboard for operational visibility. |
| Codebase | **C++** | Less forkable than Go, but 11 maintainers reduces bus factor. |

**Weaknesses:**
- FLV recording format requires post-processing (remux to MP4). Addressed by media-pipeline board's FFmpeg service + pg-boss job queue — the remux is a `ffmpeg -c copy` command (zero re-encoding, seconds to complete).
- S3 recording integration requires Oryx layer or post-process upload to Garage. Post-process upload is the planned approach anyway (webhook triggers upload after remux).
- Chinese-first docs are an operational inconvenience, not an architectural blocker. English docs exist and SRS has extensive examples.
- nginx-like config format is less readable than YAML but is well-documented and version-controllable.

---

## Option C: MediaMTX

[MediaMTX](https://github.com/bluenviron/mediamtx) — MIT license, Go, 18.3k GitHub stars, 1 primary maintainer (Alessandro Ros), releases every 2-3 weeks. Latest: v1.17.0 (2026-03-17).

| Requirement | Rating | Notes |
|-------------|--------|-------|
| Multi-channel | **Workable** | Path-based model. Each RTMP publish to a unique path creates a stream. But paths ideally defined in YAML upfront. |
| Dynamic lifecycle | **Workaround** | Dynamic paths work but are a workaround, not the intended model. PATCH API modifies path configs at runtime. |
| Simulcast | **Fragile** | `runOnReady` FFmpeg hooks. Documented reliability issues: hooks don't always fire, no process supervision, no reconnect handling. |
| Auth | **External** | Requires building a separate auth server. No built-in callback model. More code to build and maintain. |
| Recording | **Segment-based** | fMP4 or MPEG-TS segments. Crash-safe. Browser-playable without remux (fMP4). |
| Webhooks | **Limited** | `runOnReady`, `runOnNotReady`, `runOnRecordSegmentComplete`. Fewer event types than SRS. |
| Stats | **Basic** | API provides stream info but less granular than SRS. |
| SRT ingest | **Native** | Automatic protocol bridging. SRT in → HLS/RTMP/WebRTC out, zero config. |
| Low-latency | **Weak** | WebRTC supported but CPU spikes with concurrent viewers. Scales poorly. |
| HLS quality | **Better** | LL-HLS support. fMP4 segments. Lower perceived latency than standard HLS. |
| Recording format | **fMP4** | Browser-ready, crash-safe. No remux step needed. Genuine advantage. |
| DVR/rewind | **Not native** | No DVR subsystem. Would need segment accumulation workaround. |
| Clips | **Harder** | Segment-based recording is less natural for timestamp-accurate extraction. |
| Co-streaming | **Workable** | Path-based channels work but are workarounds, not native dynamic channels. |
| Premieres | **Workable** | Playout publishes to a path. Works but less natural than SRS. |
| ABR path | **Similar** | FFmpeg sidecar approach is the same. No native ABR. |
| Config/docs | **Strong** | English-first, YAML config, OpenAPI spec. Best developer experience. |
| Image size | **24.5MB** | Half the size of SRS. |
| Admin UI | **None** | API only. No web dashboard. |
| Codebase | **Go** | More forkable than C++. But single maintainer (bus factor). Mitigated by `bluenviron` org transfer. |

**Key weakness:** Simulcast forwarding is unreliable. This is a critical requirement — S/NC's no-exclusivity competitive advantage depends on reliable simulcasting to Twitch/YouTube/Kick. Fragile `runOnReady` hooks are not acceptable for production simulcast.

**Key strength:** fMP4 recording eliminates the remux step entirely. Browser-playable, crash-safe. This is a genuine simplification of the VOD pipeline.

---

## Scoring Matrix

Numerical scores: 3 = strong fit, 2 = adequate, 1 = weak/workaround, 0 = not viable.

| Requirement | Weight | Owncast+Restreamer | SRS | MediaMTX |
|-------------|--------|-------------------|-----|----------|
| Multi-channel | Critical (x4) | 0 | 3 | 2 |
| Dynamic lifecycle | Critical (x4) | 0 | 3 | 1 |
| Simulcast forwarding | Critical (x4) | 2 | 3 | 1 |
| Auth integration | High (x3) | 1 | 3 | 1 |
| Recording/DVR | High (x3) | 1 | 3 | 2 |
| Webhooks/callbacks | High (x3) | 2 | 3 | 2 |
| Stats API | High (x3) | 2 | 3 | 2 |
| SRT native ingest | High (x3) | 0 | 3 | 3 |
| Low-latency (WebRTC) | Medium (x2) | 0 | 3 | 1 |
| HLS quality | Medium (x2) | 3 | 1 | 3 |
| Recording format | Medium (x2) | 1 | 1 | 3 |
| Clip creation | Medium (x2) | 0 | 2 | 1 |
| DVR/rewind | Medium (x2) | 0 | 3 | 0 |
| Co-streaming | Medium (x2) | 0 | 3 | 2 |
| Premieres | Medium (x2) | 0 | 3 | 2 |
| ABR path | Medium (x2) | 2 | 2 | 2 |
| Config/docs | Low (x1) | 2 | 1 | 3 |
| Image size | Low (x1) | 2 | 2 | 3 |
| Admin UI | Low (x1) | 2 | 3 | 0 |
| Codebase | Low (x1) | 2 | 1 | 3 |
| **Weighted Total** | | **32** | **101** | **63** |

---

## Competitive Feature Impact

How each option positions S/NC against Twitch, YouTube Live, and Kick.

### Features SRS enables that competitors have

| Feature | Twitch | YouTube | Kick | SRS enables | MediaMTX enables |
|---------|--------|---------|------|-------------|-----------------|
| Low-latency mode | Yes | Yes | No | WebRTC (WHIP/WHEP) | Weak (CPU scaling) |
| Live rewind/DVR | No | Yes | No | Native DVR | Not native |
| Clips | Yes | Yes | Yes | DVR + timestamps | Harder (segments) |
| Simulcast | Blocked (exclusivity) | N/A | N/A | Native forwarding | Fragile hooks |
| Multi-creator | Squad Stream | N/A | N/A | Native multi-channel | Workaround |
| Premieres | No | Yes | No | Playout → channel | Playout → path |
| VOD recording | Auto-delete 14-60d | Permanent | Permanent | DVR → remux → S3 | fMP4 → S3 |
| Raids | Yes | No | No | Multi-channel aware | Path-based |

### S/NC-specific competitive advantages SRS supports

1. **No-exclusivity simulcast** — native `forward` directive reliably pushes to Twitch/YouTube/Kick simultaneously. S/NC never locks creators in. (Twitch Affiliates cannot simulcast; S/NC creators can.)
2. **Music licensing freedom** — S/NC Records artists stream with their own catalog. No DMCA risk. Server choice doesn't affect this, but reliable streaming infrastructure makes it viable at scale.
3. **Shared channel model** — TV model's always-on playout + dynamic live channels naturally gives smaller creators access to the full audience. SRS's native multi-channel makes this architecturally clean.
4. **VOD as premium** — DVR recording captures every stream. Post-processing via media-pipeline job queue. Persistent VODs behind subscription paywall (vs Twitch auto-delete).
5. **Low-latency path** — WebRTC enables future interactive features (polls, predictions, channel points, Q&A) that compete with Twitch's engagement tooling.

---

## Decision: SRS

SRS is selected as the unified streaming server replacing Owncast + Restreamer for Phase 3+.

**Primary reasons:**
1. Native multi-channel — core TV model requirement, no workarounds needed
2. Native simulcast forwarding — reliable, production-grade, no FFmpeg hook fragility
3. Mature WebRTC — clear path to low-latency interactive features (competitive parity with Twitch/YouTube)
4. Native DVR — enables both VOD recording and live rewind (YouTube-style differentiator)
5. Built-in HTTP callback auth — fits multi-creator stream key rotation without building an external auth server

**Accepted trade-offs:**
- FLV recording format requires `ffmpeg -c copy` remux to MP4. Handled by the media-pipeline board's FFmpeg service + pg-boss job queue. Zero re-encoding, completes in seconds.
- Chinese-first docs. English docs exist; SRS has extensive examples and a web admin UI for operational visibility.
- nginx-like config format. Less readable than YAML but well-documented and version-controllable.

**What becomes platform-built (was free with Owncast):**
- Chat (real-time text, moderation, patron badges, emotes)
- ActivityPub go-live notifications
- Web player (already built — Vidstack on `/live`, server-agnostic)

---

## References

- `streaming-infrastructure.md` — original streaming tool evaluation
- `irl-streaming.md` — SRS vs MediaMTX comparison tables, IRL streaming architecture
- `boards/platform/s-nc-tv/design/tv-model-architecture.md` — TV model architecture decision (now closed)
- `../../docs/research/competitive/streaming.md` — Twitch, YouTube Live, Kick competitive analysis
- `boards/platform/s-nc-tv/DECISIONS.md` — formal decision record
- `boards/platform/s-nc-tv/design/vod-recording-spike.md` — VOD recording architecture (updated for SRS DVR)

*Last updated: 2026-03-25*
