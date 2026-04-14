# IRL Streaming (Belabox + SRTLA)

**Status:** Draft
**Date:** 2026-03-24

Technical research on IRL (In Real Life) streaming for S/NC using Belabox on an Orange Pi 5 Plus with bonded cellular + WiFi connectivity via SRTLA. Covers field hardware, self-hosted SRTLA relay architecture, integration with the existing Owncast + Restreamer pipeline, and a comparative evaluation of SRS and MediaMTX as potential Restreamer replacements. The relay server evaluation is presented without a recommendation — the decision is deferred until Restreamer replacement becomes urgent.

**Key architecture:** Belabox bonds multiple network connections via SRTLA protocol, a self-hosted relay (OpenIRL srtla-receiver) reassembles the bonded stream into standard SRT, and a conversion step feeds RTMP into the existing pipeline. From Restreamer onward, everything is identical to studio OBS streaming.

---

## Use Case

- **Live music events** (primary) — streaming concerts, rehearsals, and sessions from venues. Audio quality is paramount.
- **Freeform IRL content** (secondary) — outdoor shoots, location scouting, behind-the-scenes, community events.
- **Any situation without fixed broadband** — venues with unreliable WiFi, outdoor locations, spaces where running Ethernet isn't practical.

---

## Hardware

### Belabox Encoder (Field Unit)

**Board:** Orange Pi 5 Plus (RK3588 SoC, hardware H.264/H.265 encoding)

The Orange Pi 5 Plus has a **built-in HDMI input port** (full-size HDMI). Belabox for RK3588 supports it natively — no USB capture card is needed. The RK3588's hardware video encoder handles H.265/HEVC encoding directly.

**RF interference caveat:** On all RK3588 boards, placing LTE/5G modems near the HDMI cable or the board can cause HDMI capture failures. This is a hardware-level issue with no software fix. Mitigation: physically separate modems from the board and HDMI cable using short USB extension cables, or mount modems in a separate pouch/enclosure.

**Community note:** The Belabox project currently recommends the Radxa Rock 5B+ over the Orange Pi 5 Plus for better RF isolation, USB PD power input, and an M.2 modem slot. The Orange Pi 5 Plus works but requires more care with modem placement and power management.

### Cellular Modems

Use **2-3 modems on different carriers** for effective SRTLA bonding (e.g., T-Mobile, Verizon, AT&T in the US). Two is the minimum for bonding; three gives good redundancy.

| Type | Examples | Pros | Cons |
|------|----------|------|------|
| **USB LTE sticks** | Huawei E3372h (-607, -320) | Cheap (~$30), simple, low power, proven | LTE Cat 4 only (~50 Mbps max), aging hardware |
| **Tethered phones** | Pixel 3a/4a, iPhone, Orbic Myra 5G | Better modems (5G capable), screen for signal | Higher power draw, more bulk |
| **MiFi/hotspot via USB** | Netgear Nighthawk M1/M5/M6 | Good radios, external antenna ports | More expensive ($150-400) |
| **M.2 modules** | Quectel RM520N-GL, EC25-G | Best performance, compact, pro-grade | Needs adapter board, more complex setup |

**Practical starting point:** 2-3 Huawei E3372h sticks on different carriers. Upgrade to M.2 modules (Quectel RM520N-GL) if 5G speeds or better coverage are needed.

**Data plans:** Use different carriers for true redundancy. MVNOs offer cheaper data (Mint Mobile on T-Mobile, Visible on Verizon, Cricket on AT&T). Look for unlimited hotspot plans or IRL streaming-specific data services. Data plans are the primary ongoing cost (~$75-120/mo for 3 SIMs).

### Power

The Orange Pi 5 Plus does **not support USB PD power negotiation** — it accepts **5V input only**. This is a practical limitation when powering multiple USB modems.

| Component | Estimated Draw |
|-----------|---------------|
| Orange Pi 5 Plus (encoding 1080p) | 6-10W |
| USB LTE modem (per stick, actively transmitting) | 2-4W each |
| WiFi adapter | 1-2W |
| **Total system (board + 2-3 modems + WiFi)** | **~12-20W** |

**Powered USB hub recommended** to offload modem power from the board's USB ports (community-tested: iDsonix 4-port 5V/2A, UGREEN 4-port).

**Battery banks** (community-tested):

| Battery | Capacity | Estimated Runtime |
|---------|----------|-------------------|
| Anker PowerCore+ 26800 PD 45W | 26,800 mAh | ~7-9 hours |
| Baseus 65W 30,000 mAh | 30,000 mAh | ~8-10 hours |
| Charmast 26,800 mAh | 26,800 mAh | ~7-9 hours (budget) |

Runtime estimates assume ~15W average draw and typical battery efficiency losses.

### Audio for Live Music

Audio enters the Belabox pipeline through the HDMI input (embedded audio from the camera or source device). Belabox uses GStreamer with `alsasrc` for audio capture.

**Default audio:** AAC at 128 Kbps via `voaacenc`. This is adequate for speech but thin for music.

**For live music, bump to 192-256 Kbps AAC.** This requires modifying the `voaacenc bitrate=` parameter in the GStreamer pipeline configuration. Opus is also supported in Belabox RK3588 builds — Opus 128-160 Kbps is roughly equivalent to AAC 192-256 Kbps due to superior compression.

**Getting audio from the venue mixer into Belabox:**

| Approach | Setup | Quality |
|----------|-------|---------|
| **Board feed via camera line-in** (recommended) | Stereo line-level from mixer → pad/attenuator → camera 3.5mm mic input → HDMI to Belabox | High — source quality from the board |
| **HDMI audio embedder** | Mixer line-out → HDMI embedder → HDMI to Belabox | High — dedicated device, clean signal |
| **ATEM Mini or similar switcher** | Mixer line-out → ATEM Mini mic/line input → HDMI out to Belabox | High — also adds video switching capability |
| **Camera onboard mic** | Camera mic picks up venue audio | Low — clips on loud music, crowd noise, poor frequency response |
| **USB audio interface** | USB interface on Orange Pi, custom GStreamer pipeline | High potential, but not well-documented for Belabox |

**Audio passthrough chain:** The entire relay path (SRTLA → srtla-receiver → SRT → ffmpeg → RTMP → Restreamer → Owncast ingest) uses codec copy — no audio re-encoding until Owncast's HLS transcoding. Owncast typically passes through AAC audio in HLS output, but this should be verified during testing.

### Camera

For live music venues, prioritize **low-light performance** and **clean HDMI output**.

| Type | Examples | Notes |
|------|----------|-------|
| **Mirrorless** (best for venues) | Sony ZV-E10 II, Sony a6700, Canon EOS R50 | Excellent low light with fast lenses (e.g., Sigma 16mm f/1.4). Clean HDMI, unlimited recording as HDMI source. Run on AC adapter (dummy battery) at venues with power. |
| **Action cameras** (best for mobility) | GoPro HERO 13 (with Media Mod), DJI Osmo Action 5 Pro | Small sensors = poor low light. Fine for daytime/outdoor. GoPro needs Media Mod for HDMI out. |

**Resolution:** 1080p30 is the practical choice for live music. Stage lighting is relatively static (not fast motion), and 30fps halves bandwidth requirements, giving more headroom for stability over cellular. Test 1080p60 if bandwidth allows.

**Bitrate guidance** (from Belabox docs):

| Setting | Indoor (phone screen) | Indoor (27" monitor) |
|---------|----------------------|---------------------|
| 1080p30 | 2,500-4,000 Kbps | 4,000-6,000 Kbps |
| 1080p60 | 3,000-4,000 Kbps | 5,000-7,000 Kbps |

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
Camera → HDMI → Belabox (Orange Pi 5 Plus)
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
Camera → HDMI → Belabox (Orange Pi 5 Plus)
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
| Ingest source | Desktop OBS | Orange Pi 5 Plus |
| Protocol to relay | RTMP (or SRT if relay supports it) | SRTLA → SRT → RTMP |
| Network | Fixed broadband | Bonded WiFi + cellular |
| Extra infra needed | None | srtla-relay LXC |
| Pipeline from relay server onward | Identical | Identical |

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

**Decision (2026-03-25):** SRS selected as the unified streaming server replacing both Owncast and Restreamer. See `streaming-server-evaluation.md` for the full evaluation; the decision record lives on the streaming board in the monorepo parent. The comparison below remains as reference.

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

## Outstanding Decisions

- ~~**Relay server choice**~~ — **Decided: SRS** (2026-03-25). See `streaming-server-evaluation.md`. SRS selected for native multi-channel, native simulcast forwarding, mature WebRTC, and built-in HTTP callback auth.
- **SRTLA relay hosting** — Proxmox LXC is the default recommendation. Cloud VPS ($3-5/mo) is the fallback for ISPs with CGNAT. Architecture is identical either way.
- **Audio bitrate for live music** — Test AAC 192kbps vs 256kbps through the full pipeline. Verify Owncast passes through AAC audio without re-encoding.
- **Monitoring integration** — Wire srtla-receiver stats and ffmpeg metrics into the Grafana/Loki stack (per `boards/infra/guides/monitoring-deploy.md`).
- **Belabox failover** — Configure a secondary output target in Belabox for when the primary relay is unreachable.
- **srtla-receiver build verification** — Confirm OpenIRL srtla-receiver Docker image runs on x86_64 (Proxmox host architecture).

---

## Cost Estimate

| Component | Budget | Mid-Range | Notes |
|-----------|--------|-----------|-------|
| SBC | Orange Pi 5 Plus (~$90) | Already owned | |
| Modems (x3) | Huawei E3372h x3 (~$90) | Quectel RM520N-GL M.2 + 2x E3372h (~$200) | Different carriers each |
| Battery | 26,800 mAh PD (~$50) | 30,000 mAh 65W PD (~$80) | |
| Powered USB hub | ~$20 | ~$30 | Offload modem power from board |
| Camera | Existing or used GoPro (~$250) | Sony ZV-E10 II + 16mm f/1.4 (~$1,100) | Mirrorless far better for venues |
| Audio | Board feed via camera line-in (~$10) | HDMI embedder (~$50) | Board feed is worth the effort |
| Relay hosting | Proxmox LXC (free) | Cloud VPS (~$5/mo) | LXC recommended |
| Data plans | 3x MVNO unlimited (~$75-120/mo) | 3x MVNO unlimited (~$75-120/mo) | Ongoing cost |
| **Total hardware** | **~$510** | **~$1,560** | Excludes camera and data plans |

---

## References

- [Belabox (BELABOX GitHub org)](https://github.com/BELABOX)
- [Belabox for RK3588](https://belabox.net/rk3588/)
- [Belabox Peripherals Wiki](https://github.com/BELABOX/tutorial/wiki/Peripherals,-accessories-and-power-banks)
- [Belabox Bitrate Guide](https://github.com/BELABOX/tutorial/blob/main/bitrate_guide.md)
- [SRTLA protocol (srtla)](https://github.com/BELABOX/srtla)
- [SRT protocol (Haivision)](https://github.com/Haivision/srt)
- [SRS (Simple Realtime Server)](https://github.com/ossrs/srs)
- [SRS Oryx](https://github.com/ossrs/oryx)
- [MediaMTX](https://github.com/bluenviron/mediamtx)
- [NOALBS](https://github.com/NOALBS/nginx-obs-automatic-low-bitrate-switching)
- [S/NC streaming infrastructure research](streaming-infrastructure.md)
- [S/NC streaming board](../../boards/platform/streaming/BOARD.md)

---

## Current Inventory

Hardware on hand from the first IRL streaming experiment (2025-2026):

| Item | Status | Role Going Forward |
|------|--------|--------------------|
| Orange Pi 5 Plus 16GB + 256GB eMMC + PSU | Owned | Repurpose as dev board — replaced by Rock 5B+ |
| Orange Pi 5 Plus WiFi 6 module (R6, PCIe E-Key) | Owned | Check E-Key compatibility with Rock 5B+; replace (~$15) if needed |
| Elgato Cam Link 4K (HDMI to USB 3.0) | Owned | Backup — not needed since Rock 5B+ has native HDMI input |
| 50k mAh power bank | Owned | Primary power for backpack rig; USB PD negotiation works with Rock 5B+ |
| Orange Pi 5 Plus aluminum case | Owned | Not compatible with Rock 5B+ form factor |
| Sony FDR-X3000 action cam | Owned | Retired — small sensor, poor low light, limited management, no clean HDMI without dock |
| Google Pixel 7a | Owned (boot issue) | Repurpose as dedicated 5G modem via USB tethering once repaired |
| Budget 4G USB modems (various) | Discarding | Inconsistent performance in crowded RF environments |

### Lessons from First Experiment

Field-tested at a multi-stage downtown music festival. Key issues:

1. **Modem reliability** — Budget LTE sticks couldn't hold connections at crowded festival with congested cell towers.
2. **WiFi unusable in crowds** — Too many devices competing on the same bands; phone hotspot was not a viable bonding link.
3. **Management overload** — One phone cannot simultaneously serve as modem, Belabox monitor, and stream manager. Dedicated roles per device are essential.
4. **Action cam limitations** — FDR-X3000 overheated, disconnected from phone apps, poor low-light performance at stage lighting levels, limited remote management.
5. **Backpack rig chaos** — Loose components, tangled cables, RF interference from modems near the board, no way to check status without stopping and digging in.

---

## Planned Upgrade: Backpack Rig v2

### Hardware Procurement

**Compute & Connectivity:**

| Item | Est. Cost | Notes |
|------|-----------|-------|
| Radxa Rock 5B+ 8GB/64GB eMMC + case (RS129-D8E64) | $256 (purchased) | Belabox encoder — native M.2 B-Key modem slot, USB PD, better RF isolation. Includes case and 64GB eMMC. Scarcity premium (~$100 over typical). |
| Fibocom FM350-GL 5G M.2 modem | $40 (purchased) | MediaTek T700, 4.67 Gbps DL, HP OEM pull. Belabox support added by project maintainer (rationalirl) Nov 2024, RK3588-only. Uses MHF4/IPEX4 antenna connectors (not u.FL). Quectel RM520N-GL (~$180) as fallback if FM350 proves unreliable. |
| 4x MHF4/IPEX4 to SMA female pigtail cables | ~$12 | Route from FM350 modem to SMA panel mounts. MHF4 is smaller than u.FL — must match FM350's connector type. |
| 4x stubby 5G SMA antennas | ~$30 | Strap-mounted, omnidirectional |
| ~~Radxa Rock 5B+ aluminum case~~ | — | Included with board purchase |

**Camera & Signal:**

| Item | Est. Cost | Notes |
|------|-----------|-------|
| Sony FX30 body + XLR handle unit | $2,008 (purchased, refurb) | Cinema body, full-size HDMI, IBIS, S-Cinetone/S-Log3, built-in cooling fan (continuous recording without overheating), tally light. XLR handle adds 2x XLR/TRS + 3.5mm audio inputs (4-channel recording) — stereo venue audio via dual XLR from mixer L/R. |
| Tamron 17-70mm f/2.8 Di III VC (E-mount) | $560 (purchased, used) | Versatile zoom for both streaming and music video production. Constant f/2.8, optical stabilization stacks with FX30 IBIS. Covers wide stage shots (25.5mm equiv.) to tight framing (105mm equiv.). |
| Manfrotto MVMXPRO500 video monopod kit | $210 (purchased) | Fluid head + FLUIDTECH self-standing base. Supports all-day festival carry; save gimbal purchase for dedicated production work later. |
| Dummy battery + AC adapter | ~$25 | Continuous power at venues with outlets |
| Short HDMI cable (full-size) | $0 (owned) | FX30 → Rock 5B+ HDMI input |

**Power:**

| Item | Est. Cost | Notes |
|------|-----------|-------|
| Powered USB hub (4-port, 5V/2A) | ~$25 | Offload backup USB modems from board power |
| Short USB-C cable | $0 (owned) | Battery bank → Rock 5B+ |

**Backpack Rig:**

| Item | Est. Cost | Notes |
|------|-----------|-------|
| Camera cube insert (optional — test without first) | ~$40 | Padded insert if LTT backpack's built-in organization isn't sufficient. Peak Design Small or F-Stop ICU. |
| Velcro cable ties (assorted) | ~$8 | Lock down every component and cable |
| Phone strap mount (sternum strap clip) | ~$12 | Belabox web UI monitoring at a glance |
| SMA panel-mount adapters or rubber grommet | ~$12 | Antenna cable pass-through from bag to shoulder straps |

**Data Plans (ongoing):**

| Item | Est. Cost | Notes |
|------|-----------|-------|
| 5G plan for Quectel (T-Mobile MVNO) | ~$30-40/mo | Primary bonding link |
| Existing SIM(s) for backup USB sticks | Existing | Secondary carriers for redundancy |
| Pixel 7a as 3rd modem (after repair) | $0 | Third carrier via USB tethering |

**Budget Summary:**

| Category | Spent | Remaining |
|----------|-------|-----------|
| Compute: Rock 5B+ w/ case, FM350-GL modem | $296 | — |
| Compute: pigtails, antennas, SMA adapters | — | ~$54 |
| Camera: FX30 + XLR handle, Tamron lens, monopod | $2,778 | — |
| Camera: dummy battery + AC adapter | — | ~$25 |
| Power: USB hub | — | ~$25 |
| Backpack: camera cube (optional), velcro, phone mount, grommet | — | ~$60 |
| **Totals** | **$3,074** | **~$164** |
| **Projected grand total** | | **~$3,238** |
| Ongoing data | | ~$30-40/mo + existing plans |

Items owned (no cost): LTT 35L backpack, 50k mAh battery, short HDMI cable, USB-C cable, XLR cables, Pixel 7a (pending repair).

### Backpack Layout

```
LTT BACKPACK 35L — STORAGE COMPARTMENT (18" x 12.75" x 5")
┌─────────────────────────────┐
│  TOP ZONE                   │  Rock 5B+ in aluminum case
│  Rock 5B+ + FM350-GL modem  │  MHF4 pigtails route up
│  (camera cube or padded)    │  through top zipper/grommet
│  HDMI cable exits here ↗    │  to SMA antennas on straps
├─────────────────────────────┤
│  MIDDLE                     │  Use existing elastic loops
│  Powered USB hub            │  and mesh pockets for cables
│  + backup USB modem(s)      │
├─────────────────────────────┤
│  BOTTOM                     │  Heaviest item lowest
│  50k mAh battery bank       │  USB-C cable up to board
└─────────────────────────────┘

TECH COMPARTMENT: Empty or tablet for monitoring
ANTENNA ROUTING: MHF4 pigtails → SMA panel mounts/grommet
  → stubby antennas clipped to shoulder straps
STERNUM STRAP: Phone mount — Belabox web UI at a glance
HANDS: Camera on monopod — only thing you touch while live
```

**Design goal:** Once the rig is powered on, interact only with the camera (in hands) and phone (on chest strap). Everything in the bag stays sealed and running.

### Camera Decision: Why FX30

Evaluated for dual-purpose use — IRL streaming at festivals and music video production for the co-op.

| Considered | Price | Verdict |
|------------|-------|---------|
| **Sony FX30** (selected) | ~$1,798 new / ~$1,600-1,720 used | Full-size HDMI (no adapter), IBIS, cinema body with built-in cooling fan (continuous recording without overheating), tally light, S-Cinetone + S-Log3. Optional XLR handle (~$350) adds pro audio inputs for production. Best fit for streaming reliability + production quality. MSRP $1,800. |
| Sony a6700 | ~$900-1,100 | Same sensor, IBIS, but micro HDMI (adapter risk in rig), no tally light, photo-hybrid body. Better if stills are also needed. |
| Sony ZV-E10 II | ~$700 | Lighter, no IBIS (needs gimbal or stabilized lens), micro HDMI. Good budget option. |
| Sony a6400 | ~$500 used | No IBIS, older processor, micro HDMI. Value pick if mostly tripod/monopod shooting. |
| Action cams (GoPro/DJI) | ~$300-350 | Tiny sensors, poor low light, overheat, unreliable app connectivity. Not suitable for venue work. |

All Sony options share E-mount — lenses carry forward on upgrade. Sigma 16mm f/1.4 works on all of them. Tamron 17-70mm f/2.8 VC recommended as a second lens for music video zoom work (~$700, adds optical stabilization).

### Encoder Decision: Why Belabox on Rock 5B+

| Considered | Cost | Self-Hosted Relay? | Verdict |
|------------|------|--------------------|---------|
| **Belabox on Radxa Rock 5B+** (selected) | ~$120 board | Yes — existing SRTLA pipeline unchanged | Community-recommended board, native M.2 modem slot, USB PD, better RF isolation. Clean upgrade path. |
| Belabox on Orange Pi 5 Plus (current) | Owned | Yes | No native modem slot, RF interference issues, no USB PD. Retire to dev board role. |
| Belabox Bee (dedicated hardware) | Unknown (limited stock) | Yes | Purpose-built but limited availability, less flexible than SBC approach. |
| LiveU Solo PRO | ~$1,000-1,500 + $450/yr | No — locked to LiveU cloud | Vendor lock-in, incompatible with self-hosted infrastructure. |
| Teradek VidiU X | ~$1,000+ + cloud sub | No — locked to Teradek Core | Same vendor lock-in problem. |
| Moblin (iOS app) | Free | Yes | Good emergency backup encoder via iPhone + HDMI dongle. Not a primary solution. |
| Custom GStreamer/ffmpeg on SBC | Similar to Belabox | Yes | Reimplements existing Belabox functionality for no benefit. |

---

*Last updated: 2026-04-11*
