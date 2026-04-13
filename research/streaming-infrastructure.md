# Streaming Infrastructure (S-NC.tv)

**Status:** Draft
**Date:** 2026-03-05

Technical research on self-hosted live streaming infrastructure for the S/NC platform. Evaluates open-source streaming servers, multi-destination broadcasting tools, and integration with S/NC's existing stack (Hono API + TanStack Start + PostgreSQL, self-hosted on Proxmox LXC containers behind Caddy). Covers Owncast, PeerTube, SRS, MediaMTX, Ant Media Server CE, and Stream.Place for streaming; Restreamer for multi-destination relay.

**Key decision (Phase 1-2):** Owncast as primary streaming backend + Restreamer as multi-destination relay. Both MIT/Apache 2.0, Docker-deployable alongside the existing stack.

**Key decision (Phase 3+, 2026-03-25):** SRS replaces both Owncast and Restreamer as a unified streaming server. SRS handles multi-channel ingest (TV model), simulcast forwarding, DVR recording, and HTTP callback auth. See `streaming-server-evaluation.md` for the full three-option evaluation and `boards/platform/s-nc-tv/DECISIONS.md` for the decision record.

**Latency:** HLS (10-30s) is acceptable. Sub-second WebRTC (via SRS) noted as future upgrade path only.

---

## Evaluation Criteria

What S/NC needs from streaming infrastructure, derived from charter values and the feature backlog:

- **Open source** — MIT/Apache preferred, AGPL acceptable. No open-core feature gating.
- **No DRM** — charter commitment. Server-side content gating (existing Stripe subscriptions) for premium content; no client-side restrictions on playback.
- **Self-hosted on Proxmox** — runs in LXC containers on existing infrastructure behind Caddy. No cloud dependencies, no crypto token requirements.
- **RTMP ingest** — OBS and Streamlabs compatibility. Non-technical creators must be able to stream without special software or protocol knowledge.
- **Multi-destination streaming** — broadcast simultaneously to Owncast (S/NC frontend) + Twitch + YouTube + other platforms.
- **API for integration** — REST API and/or webhooks to connect with the existing Hono backend for notifications, scheduling, and VOD pipeline.
- **ActivityPub alignment** — federation strategy established in `federation-protocols.md`. Streaming infrastructure should complement, not conflict with, the planned Fedify integration.
- **Sustainable resource footprint** — Proxmox host with per-service LXC containers, not GPU-dependent. Hardware transcoding (GPU passthrough) is possible on Proxmox if needed.

---

## Streaming Servers

### Owncast (Recommended — primary streaming backend)

[Owncast](https://github.com/owncast/owncast) is a self-hosted, single-user live streaming server. MIT license, Go + React, ~10.9k GitHub stars, 183 contributors, v0.2.4 (January 2026).

**What it does:**
- RTMP ingest from OBS/Streamlabs
- HLS adaptive bitrate output (multiple quality variants)
- Built-in chat (WebSocket-based, embeddable)
- Built-in ActivityPub federation — go-live notifications to fediverse followers
- Comprehensive REST API (stream status, chat, viewers, server config) + webhooks (7 event types: stream started/stopped, chat messages, follows, etc.)
- Embeddable player (iframe or raw HLS feed for a custom player)
- Web-based admin dashboard

**Transcoding:** Built-in FFmpeg adaptive bitrate. Creator sends high-quality source (e.g., 1080p from OBS), Owncast transcodes to multiple HLS variants (1080p/720p/480p). Viewers auto-select best quality based on connection. Also supports passthrough mode (no transcode — source quality only, lowest CPU cost).

**Hardware acceleration:** Supports NVENC, QuickSync, VA-API for hardware-accelerated transcoding. Proxmox supports GPU passthrough to LXC containers, making hardware transcoding viable. Software transcoding (CPU) is the default.

**Resource requirements:**
- ~1 CPU core per quality variant (constant, regardless of viewer count)
- 4 CPU cores allocated to streaming LXC = ~2-3 quality levels comfortably
- 2-4GB RAM
- Minimal storage — HLS segments are cleaned up in real-time (no persistent video storage)

**Single-user by design:** One stream key, one channel. Fits S/NC's single-channel model where creators take turns going live. Multiple creators are managed at the application layer (S/NC platform handles scheduling, key rotation).

**Limitations:**
- HLS-only output — 10-30s latency, no WebRTC sub-second option
- SQLite storage — not PostgreSQL (separate data store from S/NC's main database)
- No native VOD — streams aren't automatically recorded (needs external tooling or webhook-triggered recording)
- No native multi-streaming — sends HLS to viewers, but can't relay RTMP to Twitch/YouTube (needs Restreamer or similar)

**License:** MIT — no restrictions.

### PeerTube (Strong alternative — watch for future integration)

[PeerTube](https://github.com/Chocobozzz/PeerTube) is a federated video platform with live streaming support. AGPLv3, Node.js + TypeScript + PostgreSQL, ~14.1k GitHub stars, v8 (December 2025).

**What it does:**
- RTMP ingest, HLS output with P2P bandwidth reduction (WebTorrent/WebRTC)
- Native ActivityPub federation — full fediverse integration
- Live streaming since v3.0 (5+ years mature), scheduled streams, VOD recording built in
- Full platform — accounts, channels, video library, comments, moderation

**Stack alignment:** Node.js + PostgreSQL matches S/NC's existing infrastructure. Could potentially share database infrastructure.

**Why it's not the primary recommendation:**
- Full platform, not a component — running PeerTube alongside S/NC's own platform is significant operational overhead and feature duplication
- Heavier resource requirements than Owncast
- Less flexible for custom integration — PeerTube wants to be the frontend, not a backend service

**When to reconsider:** If S/NC needs a standalone video hosting platform with built-in VOD, federation, and community features — and is willing to run PeerTube as the video layer rather than building custom. The AGPLv3 license means any modifications to PeerTube itself must be published.

**License:** AGPLv3 — copyleft; modifications must be released under the same license. Acceptable for self-hosted deployment, but any forks or modifications carry disclosure obligations.

### SRS — Simple Realtime Server (Most capable — consider for future scaling)

[SRS](https://github.com/ossrs/srs) is a high-performance streaming media server. MIT license, C++, ~28.6k GitHub stars (most popular open-source streaming server by stars).

**What it does:**
- All protocols: RTMP, WebRTC (sub-second latency), HLS, SRT, DASH
- Built-in multi-destination forwarding (push RTMP to multiple endpoints natively)
- Oryx web dashboard for management
- HTTP API for programmatic control
- Lightweight C++ binary, Docker-ready

**Why it's notable:** SRS is the only evaluated server that handles both sub-second WebRTC delivery and multi-destination forwarding natively. If S/NC ever needs ultra-low latency (live auctions, real-time Q&A, gaming), SRS is the upgrade path.

**Limitations:**
- No built-in chat
- No fediverse integration
- Chinese-language documentation bias — English docs exist but are less comprehensive
- More operational complexity than Owncast for the single-channel use case

**License:** MIT — no restrictions.

### MediaMTX (Lightweight building block)

[MediaMTX](https://github.com/bluenviern/mediamtx) is a protocol router. MIT license, Go, ~13k GitHub stars, single binary.

**What it does:**
- Receives RTMP, outputs WebRTC/HLS/SRT automatically
- Protocol translation with zero configuration
- Ultra-lightweight, no dependencies

**Limitations:** No multi-streaming, no UI, no transcoding, no chat. It's a protocol converter, not a streaming platform. Would need to be paired with other tools for any real functionality.

**When relevant:** As a future lightweight ingest layer if Owncast's built-in RTMP server becomes a bottleneck, or if S/NC needs to accept SRT/WHIP ingest alongside RTMP.

**License:** MIT — no restrictions.

### Ant Media Server CE (Not recommended)

[Ant Media Server](https://github.com/ant-media/Ant-Media-Server) Community Edition. Apache 2.0, Java, ~4.6k GitHub stars.

**What the CE offers:**
- RTMP ingest, WebRTC output
- Basic streaming functionality

**What's gated behind the Enterprise paywall:**
- Adaptive bitrate transcoding
- Ultra-low latency WebRTC (CE has 8-12s WebRTC latency — defeats the purpose)
- GPU encoding
- Clustering and scaling
- SRT ingest

**Resource requirements:** Minimum 4 vCPU, 8GB RAM — heavy even as a dedicated LXC container.

**Verdict:** Critical features locked behind a commercial license. The open-core model conflicts with S/NC's open-source values — the CE version is functionally a demo for the Enterprise product. Not recommended.

**License:** Apache 2.0 (CE) — but practical capabilities are severely limited without Enterprise.

### Stream.Place (Not production-ready — watch for AT Protocol convergence)

[Stream.Place](https://github.com/streamplace/streamplace) is an AT Protocol-native streaming platform. MIT license, TypeScript + Go, ~204 GitHub stars, ~63 total users ever.

**What it does:**
- Deep AT Protocol integration: embedded PDS per node, `subscribeRepos` firehose, DID-based identity
- C2PA-signed stream segments (cryptographic proof of stream origin)
- WHIP-only ingest (OBS 30+ supports WHIP; Streamlabs does not)
- Livepeer decentralized transcoding (no local CPU needed, but requires LPT/ETH tokens)

**Why it matters for S/NC's federation roadmap:**

Stream.Place's architecture is the most advanced implementation of AT Protocol for live video. Several patterns are directly relevant to S/NC's planned `com.snc.media.*` custom lexicons (per `federation-protocols.md`):

- **C2PA content provenance signing** — cryptographic proof of stream origin. Relevant to S/NC's no-DRM content authenticity goals. C2PA proves "this content came from this creator" without restricting playback — authentication without restriction.
- **AT Protocol lexicons for live video** (`com.streamplace.*`) — first real-world implementation of custom lexicons for streaming. Could inform the design of S/NC's planned `com.snc.media.*` lexicons.
- **Embedded PDS vs. sidecar PDS** — Stream.Place embeds a PDS inside the streaming node. S/NC's planned architecture uses a PDS sidecar (per federation-protocols.md). Both approaches have trade-offs: embedded gives tighter integration for streaming-specific records, sidecar gives cleaner separation of concerns.
- **First React Native AT Protocol OAuth library** — created by the Stream.Place team. Potentially useful if S/NC builds mobile clients.

**What to monitor:** If Stream.Place matures and decouples from Livepeer (or Livepeer costs become negligible), its AT Protocol-native streaming could complement Owncast's ActivityPub-native approach — giving S/NC federation coverage across both protocols at the streaming layer.

**Why not recommended for production:**
- ~204 stars, ~63 total users — extremely early stage
- Moderation tooling incomplete
- WHIP-only ingest excludes Streamlabs users
- Livepeer dependency introduces crypto token costs and external service reliance
- No HLS fallback for broad device compatibility

**Verdict:** Too immature for production. Not recommended as primary infrastructure. But its AT Protocol patterns are directly relevant to S/NC's federation roadmap and should be studied when implementing `com.snc.media.*` lexicons.

**License:** MIT — no restrictions.

---

## Multi-Destination Streaming

### Restreamer (datarhei) (Recommended — multi-streaming relay)

[Restreamer](https://github.com/datarhei/restreamer) is a self-hosted multi-destination streaming relay. Apache 2.0, Go + React, ~4.8k GitHub stars.

**What it does:**
- Receives RTMP from OBS/Streamlabs
- Forwards to unlimited RTMP destinations simultaneously (Twitch, YouTube, Owncast, etc.)
- Web UI for stream management (non-technical friendly — add/remove destinations without touching config files)
- REST API for programmatic control (S/NC platform can manage destinations via API)
- Docker-first deployment
- Lightweight when not transcoding (pass-through mode)
- GDPR compliant, no telemetry, no external dependencies

**Why Restreamer over alternatives:**
- Purpose-built for multi-destination relay — does one thing well
- Self-hosted with no ongoing license costs
- Equivalent functionality to Restream.io ($16-49/month commercial service) at zero cost
- Web UI makes it accessible to non-technical creators for destination management

**License:** Apache 2.0 — no restrictions.

### Other tools evaluated

**nginx-rtmp-module:** BSD-2-Clause, config-driven `push` directive forwards RTMP to multiple destinations. Functionally capable but unmaintained (last upstream commit 2017), no UI, no API, requires nginx config editing for any change. Not recommended for a platform where non-technical creators need to manage streams.

**Stream Sprout:** MIT, runs on the streamer's local machine (not server-side). Splits OBS output to multiple RTMP destinations locally. Useful for individual streamers but doesn't fit S/NC's server-side architecture where the platform manages multi-destination relay.

---

## Recommended Architecture

**Primary recommendation: Owncast + Restreamer**

```
Creator (OBS/Streamlabs)
    |
    v RTMP
Restreamer ---------- RTMP ----> Twitch
    |           |---- RTMP ----> YouTube
    |           '---- RTMP ----> (other destinations)
    v RTMP
Owncast ------------ HLS -----> S/NC TanStack Start frontend (embedded player)
    |           |--- AP -------> Fediverse followers (go-live notifications)
    |           '--- Webhooks -> S/NC Hono API (notifications, scheduling, VOD triggers)
    |
    '-- Chat (WebSocket) ------> Embedded in S/NC frontend or custom UI via API
```

**Why this combination:**
- Owncast handles streaming + chat + ActivityPub in one service
- Restreamer handles multi-destination relay cleanly
- Both MIT/Apache 2.0 — no copyleft or feature gating
- Both Docker-deployable alongside existing PostgreSQL + Hono stack
- Creator workflow: configure OBS once (point at Restreamer RTMP URL), platform handles the rest
- S/NC platform integrates via Owncast REST API + webhooks + HLS embed

**What S/NC builds on top:**

| Feature | Implementation |
|---------|---------------|
| Stream scheduling (creator time slots) | S/NC platform feature using Owncast webhooks |
| VOD pipeline (post-MVP) | Owncast `STREAM_STOPPED` webhook triggers recording pipeline (FFmpeg/storage hook saves to S/NC's StorageProvider, creator reviews and publishes as gated content via existing content publishing flow) |
| Off-air programming (playlist loop) | Custom feature — FFmpeg + RTMP to Owncast (deferred to separate research) |
| Patron badges, polls, reactions | Custom chat overlay or Owncast chat API extensions |
| Clip creation | Custom feature on recorded VOD segments |
| Chat replay synced with VOD | Custom feature logging chat via webhooks |

**VOD as premium content:** Live stream = public reach. VOD = premium value behind subscription paywall. The platform already has server-side content gating (Stripe subscriptions, no DRM), so the VOD just needs to land in the same content pipeline. Architecture: Owncast webhook triggers recording, FFmpeg processes, S/NC StorageProvider stores, creator reviews and publishes.

**Alternative paths:**
- **PeerTube** — if VOD + ActivityPub integration outweighs the operational complexity of running a full second platform
- **SRS** — if sub-second WebRTC latency becomes a requirement (live auctions, real-time Q&A)
- **MediaMTX** — as a future lightweight ingest layer if Owncast's Go RTMP server becomes a bottleneck
- **Stream.Place patterns** — study and potentially adopt specific AT Protocol patterns (lexicons, C2PA signing) into S/NC's own AT Protocol layer rather than running Stream.Place as infrastructure

---

## IRL Streaming Extension

For mobile/field streaming (live music, outdoor content), the pipeline extends with a self-hosted SRTLA relay. Belabox on an Orange Pi 5 Plus bonds WiFi + cellular connections via SRTLA protocol, and a lightweight relay container (OpenIRL srtla-receiver + ffmpeg) converts the bonded SRT stream to RTMP for Restreamer ingest. The pipeline from Restreamer onward is unchanged.

See [IRL streaming research](irl-streaming.md) for full details covering Belabox hardware, relay architecture, and a comparative evaluation of SRS and MediaMTX as potential Restreamer replacements.

---

## Comparison Table

| Server | License | Stars | RTMP In | HLS Out | WebRTC | Chat | Federation | Multi-Stream | Min Resources | Maturity |
|--------|---------|-------|---------|---------|--------|------|------------|-------------|---------------|----------|
| **Owncast** | MIT | 10.9k | Yes | Yes (adaptive) | No | Yes | ActivityPub | No | 2-4 cores, 2-4GB | Stable (v0.2.4) |
| **PeerTube** | AGPLv3 | 14.1k | Yes | Yes (P2P) | No | Comments | ActivityPub | No | 4+ cores, 4GB+ | Stable (v8) |
| **SRS** | MIT | 28.6k | Yes | Yes | Yes | No | No | Yes (native) | 1-2 cores, 1GB | Stable |
| **MediaMTX** | MIT | 13k | Yes | Yes | Yes | No | No | No | <1 core, 256MB | Stable |
| **Ant Media CE** | Apache 2.0 | 4.6k | Yes | Enterprise | Degraded | No | No | Enterprise | 4 cores, 8GB | CE is limited |
| **Stream.Place** | MIT | 204 | WHIP only | No | WHIP | No | AT Protocol | No | Varies (Livepeer) | Pre-alpha |
| **Restreamer** | Apache 2.0 | 4.8k | Yes | Yes | No | No | No | Yes (purpose-built) | 1-2 cores, 1GB | Stable |

---

## Licensing Notes

- **Owncast:** MIT — free to reference, use code, modify. Include copyright notice if using substantial code portions.
- **PeerTube:** AGPLv3 — copyleft. Self-hosted deployment is fine. Any modifications to PeerTube source must be released under AGPLv3. Interacting via API from S/NC's MIT codebase is fine (API boundary, no derivative work).
- **SRS:** MIT — no restrictions.
- **MediaMTX:** MIT — no restrictions.
- **Ant Media Server CE:** Apache 2.0 — no restrictions on CE code, but practical use requires Enterprise license for core features.
- **Stream.Place:** MIT — no restrictions. AT Protocol lexicon patterns can be studied and adapted freely.
- **Restreamer:** Apache 2.0 — no restrictions. Include NOTICE file if redistributing.
- **nginx-rtmp-module:** BSD-2-Clause — no restrictions.

---

## Outstanding Decisions

- **Stream key management for multiple creators** — SRS HTTP callback auth (`on_publish`) validates per-creator stream keys. Platform API issues and rotates keys per creator session.
- **VOD storage + content pipeline** — resolved. SRS DVR records FLV → media-pipeline job queue remuxes to MP4 with faststart → uploads to Garage S3. See `boards/platform/s-nc-tv/design/vod-recording-spike.md` for the original spike (Restreamer approach, superseded) and `streaming-server-evaluation.md` for the SRS approach.
- **Chat** — resolved: platform-built. Owncast provided chat for free; SRS has no chat. Platform builds its own with patron badges, platform-native identity, moderation, and emotes.
- **Carbon accounting for streaming** — transcoding is CPU-intensive, HLS delivery is bandwidth-intensive. Both have CO2 implications. Need to extend the emissions tracking methodology (`../../research/carbon-calculation-methodology.md`) to cover streaming infrastructure.
- **AT Protocol streaming integration** — adopt Stream.Place's lexicon patterns into S/NC's `com.snc.media.*` lexicons, or wait for the AT Protocol community to standardize live video?
- **C2PA content provenance** — worth adopting for stream authenticity? Complements the no-DRM stance (proves origin without restricting playback). Implementation cost and viewer-side verification support are unknowns.

---

## VOD Recording (Spike — 2026-03-21)

Full spike documented at `boards/platform/s-nc-tv/design/vod-recording-spike.md`. Summary:

**Recommended approach:** Use datarhei Core's process API (the engine under Restreamer) to create a recording FFmpeg process alongside the existing relay processes. The recording process reads from the same ingest stream and writes directly to Garage S3 via Core's native S3 filesystem support. No new infrastructure — recording runs inside the already-deployed Restreamer instance.

**Architecture:**

```
OBS → Restreamer → push → Owncast (live HLS + chat + AP)
                 → push → Twitch/YouTube (simulcast)
                 → record → Garage S3 (VOD, managed via Core API)
```

Recording is triggered by Owncast `STREAM_STARTED`/`STREAM_STOPPED` webhooks → S/NC API → Restreamer Core API.

**Key findings:**
- Owncast has no built-in recording (issue #102, open since 2020)
- Restreamer has no UI-exposed recording, but Core's process API fully supports it
- Core natively supports S3-compatible storage via `{fs:<name>}` filesystem placeholders
- Recording the RTMP ingest (via Restreamer) is preferred over recording HLS output (via Owncast) — source quality, no latency gap
- The alternative approaches (FFmpeg against Owncast HLS, nginx-rtmp/MediaMTX as splitter) are documented as fallbacks

## Restreamer Long-Term Support (2026-03-21)

Restreamer development was paused as of Dec 2025 (issue [#960](https://github.com/datarhei/restreamer/issues/960)). The Core is stable and the process API is mature, but no new features or bug fixes should be expected. Recording via the API — the #1 community-requested feature — was never shipped in the UI.

**Risk:** If Restreamer becomes unmaintainable or introduces breaking issues, the streaming pipeline needs an alternative for RTMP fan-out and recording.

**Replacement candidates:**
- **MediaMTX** — MIT, Go, actively maintained, single binary. Built-in fMP4 recording, RTMP fan-out via proxy. Most direct 1:1 replacement. No web UI for destination management (would need to be built into S/NC platform).
- **SRS** — MIT, C++, most capable open-source streaming server (~28.6k stars). Native multi-destination forwarding, DVR recording, HTTP callbacks. Heavier deployment but more complete feature set.
- **Custom FFmpeg wrapper** — A thin Node.js or Go service managing FFmpeg processes for fan-out + recording. The fan-out is simple (`push` to RTMP endpoints); the complexity is lifecycle management, reconnect handling, and error recovery. Essentially rebuilding the subset of Core that S/NC uses.

**Update (2026-03-25):** SRS has been selected to replace both Owncast and Restreamer for Phase 3+. Restreamer's Core API approach for recording is superseded by SRS DVR. See `streaming-server-evaluation.md`.

---

## References

- [Owncast](https://github.com/owncast/owncast)
- [Owncast API documentation](https://owncast.online/api/)
- [PeerTube](https://github.com/Chocobozzz/PeerTube)
- [SRS (Simple Realtime Server)](https://github.com/ossrs/srs)
- [MediaMTX](https://github.com/bluenviern/mediamtx)
- [Ant Media Server](https://github.com/ant-media/Ant-Media-Server)
- [Stream.Place](https://github.com/streamplace/streamplace)
- [Restreamer (datarhei)](https://github.com/datarhei/restreamer)
- [C2PA specification](https://c2pa.org/)
- [S/NC federation protocols research](federation-protocols.md)
- [S/NC IRL streaming research](irl-streaming.md)
- [S/NC feature backlog — S-NC.tv section](../../org/docs/feature-backlog.md#s-nctv--live-streaming-platform)

*Last updated: 2026-03-21*
