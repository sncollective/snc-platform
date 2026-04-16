---
updated: 2026-04-16
---

# Playout System Evaluation

Research for the Phase 5 playout spike on the streaming board. Evaluates approaches for running an always-on TV channel that plays pre-recorded content continuously and yields to live streams when creators go live.

## Requirements

- Push continuous RTMP stream to SRS (our streaming server)
- Play from a managed playlist of content (sourced from Garage S3)
- Hot-reload playlist without stream interruption
- Yield to live creators on `on_publish` callback, resume playout on `on_unpublish`
- Crash recovery with position-aware restart
- VAAPI hardware encoding support (Intel UHD 630 / i7-10700)
- Docker deployment alongside existing stack

## Options Evaluated

### 1. ErsatzTV

**Eliminated.** Archived as read-only on February 26, 2026 — two days after its final release (v26.3.0). Solo maintainer (Jason Dove) stepped away. Zlib license (permissive).

Beyond the abandonment, it doesn't fit the architecture:
- No RTMP output — serves HLS/MPEG-TS for IPTV players, not push to SRS
- No live handoff — requested but never implemented (issue #1981)
- No S3 source support
- Designed for Plex/Jellyfin integration, not platform API

**Study value:** Low. The scheduling/EPG model is interesting conceptually but deeply coupled to the Plex/Jellyfin media server integration. .NET codebase limits transferability.

### 2. FFplayout

**Eliminated (with caveats).** Archived on March 9, 2026 with v1.0.0 as a "complete" release. Rust + FFmpeg daemon, GPL-3.0, solo maintainer.

The architecture was actually good for our use case:
- Native RTMP push to SRS
- JSON playlist per day, editable via REST API
- Wall-clock-aware restart (resumes at correct position)
- Live ingest mode (RTMP listen, interrupts scheduled playout)
- HTTP URL sources (S3 pre-signed URLs work)
- VAAPI support via FFmpeg params

But: archived, GPL-3.0 (copyleft constraint on redistribution), and solo maintainer. The FFplayoutX fork exists but has no stable releases and only 18 stars — too early and too risky. If ffplayout were still maintained, it would be a strong candidate.

**Study value:** High. The playout state machine (wall-clock resume, live ingest interrupt/resume, concat pipeline management) is the exact problem we'd solve in a custom build. Rust codebase — patterns are transferable, code is not. Studying the approach and reimplementing in TypeScript is not a derivative work under GPL-3.0.

### 3. Tunarr

**Eliminated as playout engine, useful as reference.** Active project (v1.2.6, March 2026), 226 releases, 40 contributors, Zlib license (permissive). TypeScript + Bun, pnpm workspaces, TanStack Router — very close to our stack.

Creates custom live TV channels from Plex/Jellyfin/Emby/local libraries. But same architectural mismatch as ErsatzTV:
- HLS/M3U output only — no RTMP push to SRS
- No live stream handoff/fallback
- No S3 source support (planned but not shipped)
- Designed for IPTV player consumption, not streaming server ingest

**Study value:** Medium-High. The most transferable codebase of the four — TypeScript FFmpeg process management (spawn lifecycle, hardware accel config, error handling, transcoding pipelines) is directly relevant to a custom playout build. Zlib license means no restrictions on studying or reimplementing patterns.

- [Tunarr GitHub](https://github.com/chrisbenincasa/tunarr) — active, 40 contributors
- [Tunarr Docker/FFmpeg config](https://tunarr.com/configure/ffmpeg/)

### 4. FFmpeg Concat/Loop (Raw)

**Not viable as standalone.** FFmpeg's concat demuxer reads the playlist once at startup — no hot-reload without process restart (visible stream interruption). Live handoff requires external kill/restart orchestration. No state management, no crash recovery beyond external watchdog. S3 works via pre-signed URLs but expiry management is the caller's problem.

Solid as the encoding substrate underneath a controller (which is what options 4 and 5 use), but not a standalone solution.

### 5. Liquidsoap

**Strong candidate.** 20+ year old OCaml-based streaming language. GPL-2.0. Maintained by the Savonet team (small but multi-person, not solo). v2.4.2 released January 2026, v2.5.x in active development.

Used in production by:
- AzuraCast (open-source radio automation platform)
- Radio France (77-station production infrastructure, see `radiofrance/rf-liquidsoap`)
- Numerous community and internet radio stations worldwide

**Fit for our use case:**
- `output.url()` with FFmpeg backend pushes RTMP to SRS
- `fallback()` operator provides native live-over-playlist priority switching — the core playout pattern
- `s3://` protocol for reading content from S3 buckets (via AWS CLI)
- `playlist()` and `request.queue()` for scheduled and dynamic content
- HTTP API for external playlist control
- Docker deployment available
- VAAPI support through FFmpeg backend

**Live handoff pattern (idiomatic Liquidsoap):**
```
live = input.rtmp(port=1936)
playlist = playlist("/path/to/playlist.m3u")
radio = fallback(track_sensitive=false, [live, playlist])
output.url(url="rtmp://srs:1935/live/channel", radio)
```
When a live RTMP source connects, `fallback()` switches to it automatically. When it disconnects, playlist resumes. This is battle-tested at scale.

**Tradeoffs:**
- Own scripting language (learning curve, though well-documented)
- GPL-2.0 — copyleft, but we're self-hosting not redistributing, so this is fine
- OCaml runtime — not in the team's existing stack, but it's a standalone service (Docker container), not integrated into the Node.js codebase
- The S3 protocol requires AWS CLI in the container

**Governance alignment:** Multi-person maintainer team, 20+ year track record, used by public radio infrastructure. No VC backing. Strong alignment with cooperative values — community-governed tool built for community media.

### 6. Custom Node.js Service + FFmpeg

**Viable alternative.** Build a process supervisor that spawns FFmpeg, manages a playlist queue from PostgreSQL/S3, and coordinates live handoff via SRS callbacks.

**Architecture:**
```
Platform API (Hono)
  → Playout Service (Node.js)
    → FFmpeg child process (RTMP push to SRS)
  ← on_publish callback from SRS
    → Kill FFmpeg, cede stream to creator
  ← on_unpublish callback from SRS
    → Restart FFmpeg at correct playlist position
```

**Strengths:**
- Maximum integration with existing platform API, SRS callbacks, PostgreSQL, Garage S3
- No external dependency bus factor
- No new language/runtime to learn
- Pre-signed URL management is trivial (generate on demand per track)
- Live handoff is a natural extension of existing SRS webhook handling

**Tradeoffs:**
- Highest upfront development cost (~400-800 lines)
- Building a process supervisor is non-trivial to get right (FFmpeg error handling, stdin/stdout management, graceful shutdown)
- The `fallback()` live-priority pattern that Liquidsoap gives you for free becomes a custom state machine
- Hot-reload without stream interruption requires careful FFmpeg concat pipe management or accept brief glitches on playlist changes

## Comparison Matrix

| Dimension | Liquidsoap | Custom Node.js + FFmpeg |
|-----------|-----------|------------------------|
| Maintenance | Active (20+ years, v2.5.x in dev) | You own it |
| License | GPL-2.0 | Your choice |
| Governance | Multi-person team (Savonet) | Your team |
| RTMP to SRS | Native (`output.url`) | Via `child_process.spawn` |
| Live handoff | Native (`fallback()`) | Custom state machine |
| Playlist hot-reload | Native (`playlist()`, HTTP API) | Custom (concat pipe or restart) |
| S3 support | `s3://` protocol | Pre-signed URLs via API |
| Crash recovery | Configurable restart behavior | Custom watchdog |
| VAAPI | Via FFmpeg backend | Via spawn flags |
| Docker | Yes | Yes |
| Learning curve | Liquidsoap scripting language | Familiar stack |
| Dev effort | Low (config + integration) | Medium-High (build from scratch) |
| Bus factor | Low (community project) | Your team |
| Cooperative alignment | Strong (public radio heritage) | Strong (self-owned) |

## Study Reference Value

Four projects inform the architecture even though none is adopted as-is:

| Project | License | Status | What to Study |
|---------|---------|--------|---------------|
| **ffplayout** | GPL-3.0 | Archived | Playout state machine: wall-clock resume, live ingest interrupt, concat pipeline, REST API playlist control |
| **Tunarr** | Zlib | Active | TypeScript FFmpeg process management: spawn lifecycle, hardware accel config, error handling, transcoding pipelines |
| **ErsatzTV** | Zlib | Archived | Scheduling/EPG model (low priority — deeply coupled to Plex/Jellyfin) |
| **Liquidsoap** | GPL-2.0 | Active | Live fallback patterns, continuous playout architecture, S3 protocol integration |

Studying patterns and reimplementing in our own codebase is not a derivative work under GPL — only copying source code verbatim would be. Zlib-licensed projects (Tunarr, ErsatzTV) have no restrictions at all.

## Recommendation

**Liquidsoap as the turnkey playout engine, with custom TS + FFmpeg as the fallback path.**

Liquidsoap handles the hard parts — live priority fallback, continuous playlist management, crash recovery, S3 content fetching — proven at scale by real radio/TV stations over 20 years. It runs as a Docker container alongside SRS. The custom TS orchestration layer stays thin: schedule data via API, SRS callback coordination for live handoff.

If Liquidsoap proves too opaque (scripting language friction, RTMP output issues, VAAPI integration problems), fall back to a custom Node.js + FFmpeg service informed by ffplayout (state machine patterns) and Tunarr (TypeScript FFmpeg management patterns). The platform integration layer (schedule API, SRS callbacks, S3 URL resolution) is the same either way — only the playout engine swaps.

**License note:** Using Liquidsoap as a running service (Docker container) has no GPL implications. GPL-2.0 only triggers on distribution of modified source code. Self-hosting is the same as running Linux or PostgreSQL.

## Spike Plan

**Phase 1: Liquidsoap validation (try first)**

1. **Liquidsoap + SRS integration proof** — Add Liquidsoap container to Docker Compose. Minimal config: playlist of test MP4s → RTMP push to SRS → HLS → verify Vidstack plays it on the live page.
2. **Live fallback test** — Does `fallback()` cleanly switch between playlist and a live OBS RTMP input? Measure transition glitch duration.
3. **S3 content source** — Can Liquidsoap read content from Garage S3 via `s3://` or HTTPS pre-signed URLs without buffering issues?
4. **VAAPI encoding** — Does Liquidsoap's FFmpeg backend support `-c:v h264_vaapi` output with CQP mode? (May need to defer to prod hardware if DinD doesn't expose `/dev/dri`.)
5. **Platform API integration** — Can the Liquidsoap HTTP API receive playlist updates from the Hono API? What's the control surface?

**Phase 2: Custom TS fallback (only if Phase 1 hits blockers)**

6. **Custom Node.js prototype** — FFmpeg spawn with concat pipe, live handoff via SRS `on_publish`/`on_unpublish` callbacks, wall-clock-aware restart. Study ffplayout (state machine) and Tunarr (TS FFmpeg patterns) as reference.

**Go/no-go criteria for Liquidsoap:** If steps 1-3 work, Liquidsoap is the engine. Steps 4-5 are nice-to-have in the spike (VAAPI can be validated on prod hardware later, API integration is well-documented). If step 1 or 2 fails, pivot to Phase 2.

## References

- [Liquidsoap GitHub](https://github.com/savonet/liquidsoap) — 20+ years, multi-person maintainer team
- [Radio France rf-liquidsoap](https://github.com/radiofrance/rf-liquidsoap) — 77-station production setup
- [Liquidsoap S3 protocol docs](https://www.liquidsoap.info/doc-dev/protocols-presentation.html)
- [Liquidsoap RTMP output discussion](https://github.com/savonet/liquidsoap/discussions/3044)
- [Liquidsoap fallback + live switching guide](https://mikulski.rocks/liquidsoap_input_rtmp_en/)
- [Tunarr GitHub](https://github.com/chrisbenincasa/tunarr) — active, TypeScript, Zlib license
- [ffplayout GitHub](https://github.com/ffplayout/ffplayout) — archived Mar 2026, Rust, GPL-3.0
- [ErsatzTV archival](https://github.com/ErsatzTV/ErsatzTV/issues/2839) — archived Feb 2026
- TV model architecture decision — parent monorepo, `boards/platform/release-0.2/design/tv-model-architecture.md`
- `boards/infra/guides/streaming-deploy-phase1-2.md` — VAAPI/CQP workaround documentation
- `multi-platform-strategy.md` — codec strategy and rendition ladder
