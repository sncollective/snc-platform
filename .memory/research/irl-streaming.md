---
updated: 2026-04-20
---

# IRL Streaming Architecture (Belabox + SRTLA)

**Status:** Reference
**Date:** 2026-03-24

Technical research on IRL (In Real Life) streaming architecture using Belabox with bonded cellular + WiFi connectivity via SRTLA. Covers the self-hosted SRTLA relay pipeline, integration with the Owncast + Restreamer stack, and the comparative evaluation of SRS and MediaMTX that informed the SRS unified streaming server decision ([platform-0001](../decisions/platform-0001-srs-unified-streaming-server.md)).

**Key architecture:** Belabox bonds multiple network connections via SRTLA protocol, a self-hosted relay (OpenIRL srtla-receiver) reassembles the bonded stream into standard SRT, and a conversion step feeds RTMP into the existing pipeline. From the relay server onward, everything is identical to studio OBS streaming.

---

## SRTLA Protocol and Self-Hosted Relay

### What SRTLA Does

SRTLA (SRT Link Aggregation) is a bonding protocol built on top of SRT. It splits a single SRT stream across multiple network interfaces (WiFi + cellular modems), sending packets over whichever connection has capacity. A receiver (`srtla_rec` or equivalent) reassembles the bonded packets into a standard SRT stream.

**SRTLA is not SRT.** Standard SRT receivers cannot accept SRTLA connections. A dedicated SRTLA receiver is required.

### Relay Options

**BELABOX's open-source `srtla_rec`** ([github.com/BELABOX/srtla](https://github.com/BELABOX/srtla)) is officially unsupported for production deployment. BELABOX's README warns it is "no longer under development and not suitable for production deployment" — their cloud relay service uses proprietary software. The open-source `srtla_rec` compiles on x86_64 (plain C, `make`), takes three arguments (`srtla_rec <listen_port> <srt_host> <srt_port>`), and requires BELABOX's patched SRT library.

**OpenIRL srtla-receiver** is the community standard for self-hosted SRTLA relays:
- Docker-based, multi-stream support
- API key authentication
- Stats endpoint for monitoring
- NOALBS-compatible (automatic bitrate switching)
- Actively maintained by the IRL streaming community

Both output **SRT only** — neither produces RTMP directly. An ffmpeg bridge or SRT-native ingest server is needed downstream.

### Self-Hosted Relay LXC

| Spec | Value |
|------|-------|
| Container type | Proxmox LXC (unprivileged) |
| Resources | 1 CPU core, 512MB-1GB RAM |
| Software | OpenIRL srtla-receiver (Docker), ffmpeg |
| Inbound | One UDP port for SRTLA (e.g., 5000), port-forwarded from router |
| Outbound | RTMP to Restreamer container (internal VLAN, port 1936) |
| Web UI | None needed — SRTLA is UDP, not HTTP |

**CGNAT note:** Some ISPs use Carrier-Grade NAT, which blocks inbound port forwarding entirely. If port forwarding is impossible, a cloud VPS relay ($3-5/mo) is the fallback. The architecture is identical — just swap where the receiver runs.

---

## Architecture

### Studio Mode (Current — Unchanged)

```
Creator (OBS/Streamlabs)
    → RTMP to Restreamer (relay.s-nc.tv:1936)
    → RTMP forward to Owncast (stream.s-nc.tv:1935)
    → RTMP forward to Twitch/YouTube (simulcast)
Owncast → HLS adaptive bitrate → viewers
```

### IRL Mode with Current Stack

```
[Field]
Camera → HDMI → Belabox encoder
    → SRTLA over WiFi + 2-3 cellular modems

[Proxmox — new LXC: srtla-relay]
OpenIRL srtla-receiver (UDP, port-forwarded from router)
    → SRT output (localhost)
    → ffmpeg (SRT → RTMP, codec copy, no re-encoding)
    → pushes RTMP to Restreamer at relay.s-nc.tv:1936

[Proxmox — existing infrastructure, unchanged]
Restreamer → RTMP → Owncast → HLS → viewers
           → RTMP → Twitch/YouTube (simulcast)
```

The ffmpeg bridge command:
```
ffmpeg -i srt://localhost:PORT?mode=listener -c copy -f flv rtmp://relay.s-nc.tv:1936/live/STREAM_KEY
```

### IRL Mode with SRT-Native Relay Server (Future)

If Restreamer is replaced with an SRT-native server (SRS or MediaMTX), the ffmpeg bridge is eliminated:

```
[Field]
Camera → HDMI → Belabox encoder
    → SRTLA over WiFi + 2-3 cellular modems

[Proxmox — srtla-relay LXC]
OpenIRL srtla-receiver
    → SRT output

[Proxmox — SRT-native relay server (SRS or MediaMTX)]
    → accepts SRT directly (no ffmpeg bridge)
    → RTMP → Owncast (HLS + chat + ActivityPub)
    → RTMP → Twitch/YouTube (simulcast)
    → DVR recording → Garage S3 (VOD)
```

This also unifies the studio path — OBS can send SRT instead of RTMP (supported since OBS v25.x), giving both paths the same ingest protocol.

### Comparison: OBS vs IRL Mode

| Aspect | OBS (Studio) | Belabox (IRL) |
|--------|-------------|---------------|
| Ingest source | Desktop OBS | Belabox encoder |
| Protocol to relay | RTMP (or SRT if relay supports it) | SRTLA → SRT → RTMP |
| Network | Fixed broadband | Bonded WiFi + cellular |
| Extra infra needed | None | srtla-relay LXC |
| Pipeline from relay server onward | Identical | Identical |

---

## Audio Passthrough

Audio enters the Belabox pipeline through the HDMI input (embedded audio from the camera or source device). Belabox uses GStreamer with `alsasrc` for audio capture.

**Default audio:** AAC at 128 Kbps via `voaacenc`. Adequate for speech but thin for music. For live music, bump to 192-256 Kbps AAC. This requires modifying the `voaacenc bitrate=` parameter in the GStreamer pipeline configuration. Opus is also supported in Belabox RK3588 builds — Opus 128-160 Kbps is roughly equivalent to AAC 192-256 Kbps due to superior compression.

**Audio passthrough chain:** The entire relay path (SRTLA → srtla-receiver → SRT → ffmpeg → RTMP → Restreamer → Owncast ingest) uses codec copy — no audio re-encoding until Owncast's HLS transcoding. Owncast typically passes through AAC audio in HLS output, but this should be verified during testing.

---

## Latency Analysis

| Stage | Latency | Notes |
|-------|---------|-------|
| Belabox encoding | 1-3s | Hardware encoder, depends on bitrate/resolution |
| SRTLA buffering | 1-3s | Jitter buffer compensates for cellular variance |
| srtla-receiver → ffmpeg | <100ms | Local process, negligible |
| Relay server forwarding | <100ms | RTMP passthrough, internal VLAN |
| Owncast HLS | 10-30s | Segment-based delivery, inherent to HLS |
| **Total** | **~12-36s** | |

For comparison, studio OBS latency is ~10-30s (HLS segment length dominates). IRL adds ~2-6s from SRTLA bonding/buffering — a minor increase. Acceptable for live music broadcast where real-time audience interaction isn't the primary concern.

---

## Relay Server Evaluation: SRS vs MediaMTX

Both SRS and MediaMTX were candidates to replace Restreamer, whose development paused in December 2025 (issue [#960](https://github.com/datarhei/restreamer/issues/960)). Either would simplify the IRL pipeline by accepting SRT natively, eliminating the ffmpeg bridge.

**Decision (2026-03-25):** SRS selected as the unified streaming server replacing both Owncast and Restreamer. See `streaming-server-evaluation.md` for the full evaluation; decision record at [platform-0001-srs-unified-streaming-server.md](../decisions/platform-0001-srs-unified-streaming-server.md). The comparison below remains as reference.

### Project Health

| | SRS | MediaMTX |
|---|---|---|
| **Repository** | [ossrs/srs](https://github.com/ossrs/srs) | [bluenviron/mediamtx](https://github.com/bluenviron/mediamtx) |
| **License** | MIT (dual MulanPSL-2.0) | MIT |
| **Language** | C++ (91.4%) | Go (95.9%) |
| **GitHub Stars** | 28.7k | 18.3k |
| **Contributors** | 11 named maintainers | 1 primary (Alessandro Ros), 185 releases |
| **Latest Release** | v6.0-r0 (2025-12-03) | v1.17.0 (2026-03-17) |
| **Release Cadence** | Monthly betas, annual stable | Every 2-3 weeks |
| **Corporate Backing** | None (OpenCollective donations) | None (unmonetized) |
| **Open-Core Risk** | None. Oryx is also MIT. | None. No commercial tier. |
| **Documentation** | Chinese-first, English available | English-first, well-structured |
| **Bus Factor** | Moderate (Winlin leads, 11 maintainers) | Low (primarily Alessandro, mitigated by Go forkability) |

**SRS governance signal:** Winlin published a self-critical "Hidden Flaws" blog post — a positive transparency signal. AI was used in 2025 to raise test coverage from 40% to 88%.

**MediaMTX governance signal:** Transferred to `bluenviron` org to mitigate bus factor. Used at scale (2000+ streams/server, adopted by NASA).

### Feature Comparison

| Feature | SRS | MediaMTX |
|---------|-----|----------|
| **SRT ingest** | Native, `srt_to_rtmp` directive | Native, automatic protocol bridging |
| **SRT tuning** | Extensive (recvlatency, peerlatency, tsbpdmode, buffer sizes) | Basic (readTimeout, writeTimeout) |
| **SRT encryption** | Yes (passphrase + AES) | Yes (per-path passphrase) |
| **Multi-dest RTMP** | Native `forward` directive + dynamic HTTP backend | FFmpeg via `runOnReady` hooks |
| **Dynamic destinations** | HTTP backend returns URL list (no restart) | PATCH API to modify path configs |
| **Recording** | DVR subsystem — FLV/MP4, session or time-segment plans | fMP4 or MPEG-TS, segment-based |
| **S3 storage** | Not built-in (Oryx adds it) | Not built-in (rclone via hooks) |
| **Recording API** | `dvr_apply` + HTTP raw API | PATCH path config `record: true/false` |
| **HTTP API** | Comprehensive, username/password auth | OpenAPI spec, JWT/HTTP auth |
| **Webhooks** | on_connect, on_publish, on_unpublish, on_play, on_dvr, on_hls | runOnReady, runOnNotReady, runOnRecordSegmentComplete |
| **Web UI** | Yes (`srs-console`) | No (API only) |
| **Config format** | Custom nginx-like `.conf` | YAML (self-documenting) |
| **Docker image** | ~49 MB | ~24.5 MB |
| **HLS output** | Yes (single quality, no adaptive bitrate) | Yes (single quality, no adaptive bitrate) |
| **NOALBS support** | Yes | Yes |

### Trade-Off Summary

**SRS strengths:**
- Native multi-destination forwarding (no FFmpeg management)
- Higher bus factor and broader contributor base
- Web admin UI for management
- Deeper SRT tuning for challenging network conditions
- More webhook event types (on_dvr, on_hls)

**MediaMTX strengths:**
- English-first documentation — more accessible for S/NC
- YAML configuration — simpler to understand and version control
- Half the Docker footprint (~24.5 MB vs ~49 MB)
- Automatic protocol bridging (SRT in → RTMP/HLS/WebRTC out, zero config)
- fMP4 recording format — crash-safe AND browser-playable, potentially eliminating the MKV→MP4 remux step identified in the earlier VOD recording spike
- OpenAPI spec for programmatic integration
- Go codebase — more forkable than C++ if maintenance becomes necessary

**Neither provides adaptive bitrate HLS, chat, or ActivityPub.** Owncast remains necessary for viewer-facing features regardless of which relay server is chosen.

### SRS Oryx

Oryx ([ossrs/oryx](https://github.com/ossrs/oryx)) is an application layer built on SRS + FFmpeg + React + Go + Redis. It adds a web management UI, S3 support, platform restreaming, and HTTPS automation. Also MIT licensed (formerly AGPL). 838 stars, 6 contributors. For S/NC, Oryx would duplicate Owncast's viewer-facing role and adds Redis as a dependency — not recommended unless the web UI is essential and Owncast is being dropped.

---

## Outstanding Decisions (Platform Scope)

- ~~**Relay server choice**~~ — **Decided: SRS** (2026-03-25). See `streaming-server-evaluation.md`. SRS selected for native multi-channel, native simulcast forwarding, mature WebRTC, and built-in HTTP callback auth.
- **SRTLA relay hosting** — Proxmox LXC is the default recommendation. Cloud VPS ($3-5/mo) is the fallback for ISPs with CGNAT. Architecture is identical either way.
- **Audio bitrate for live music** — Test AAC 192kbps vs 256kbps through the full pipeline. Verify Owncast passes through AAC audio without re-encoding.
- **Monitoring integration** — Wire srtla-receiver stats and ffmpeg metrics into the Grafana/Loki stack.
- **srtla-receiver build verification** — Confirm OpenIRL srtla-receiver Docker image runs on x86_64 (Proxmox host architecture).

---

## References

- [SRTLA protocol (srtla)](https://github.com/BELABOX/srtla)
- [SRT protocol (Haivision)](https://github.com/Haivision/srt)
- [SRS (Simple Realtime Server)](https://github.com/ossrs/srs)
- [SRS Oryx](https://github.com/ossrs/oryx)
- [MediaMTX](https://github.com/bluenviron/mediamtx)
- [NOALBS](https://github.com/NOALBS/nginx-obs-automatic-low-bitrate-switching)
- [S/NC streaming infrastructure research](streaming-infrastructure.md)

---

*Last updated: 2026-04-20 — scoped to streaming protocol and relay architecture.*
