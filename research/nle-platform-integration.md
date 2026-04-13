# NLE–Platform Integration Patterns (March 2026)

Research into how S/NC's web platform can integrate with open-source desktop video editors (NLEs) as a media hub and collaboration layer. Part of the broader strategy: S/NC handles storage, collaboration, transcoding, and delivery — desktop tools handle heavy editing.

## NLE Compatibility Matrix

| NLE | License | Project Format | HTTP Media URLs? | Headless Render? | OTIO Support? |
|-----|---------|---------------|-----------------|-----------------|--------------|
| **Kdenlive** | GPL-2.0 | MLT XML | Yes — MLT uses FFmpeg, which handles HTTP/HTTPS natively | Yes — `melt` CLI | Yes — native import/export since v25.04 |
| **Shotcut** | GPL-3.0 | MLT XML | Yes — same MLT/FFmpeg backend | Yes — `melt` CLI | Not native, but MLT XML is parseable |
| **Blender VSE** | GPL-2.0 | .blend (binary) | Via Python scripting | Yes — `blender -b -a` | Via `vse-io` add-on (validated on Blender Studio's "Sprite Fright") |
| **DaVinci Resolve Free** | Proprietary (free) | .drp (proprietary) | No — local files only | No — scripting requires GUI (automation is Studio-only, $295) | Import via EDL/AAF/XML manually |
| **DaVinci Resolve Studio** | Proprietary ($295 one-time) | .drp (proprietary) | Via scripted import (Python/Lua API) | No — no headless rendering | Import via EDL/AAF/XML; scripted project creation |
| **Olive** | GPL-3.0 | XML | Unknown | Unknown | No | Still alpha — explicitly warns of instability. Not recommended. |

### Primary Targets: Kdenlive + Shotcut

Both use MLT XML, which is the key enabler:
- **MLT's avformat producer uses FFmpeg under the hood** — confirmed: HTTP/HTTPS URLs work as media sources in `<property name="resource">`
- **`melt` CLI** renders MLT XML projects headlessly on Linux servers
- **Kdenlive 25.04** added native OTIO import/export (rewritten in C++ by Grizzly Peak 3D)
- These two NLEs give S/NC: HTTP-referenced media, headless server rendering, and OTIO interchange — all open source

### DaVinci Resolve: Free vs Studio

A team editor currently uses Resolve, so this is a real workflow to support.

**Resolve Free** has a hard paywall on automation. Scripting only works from inside the Resolve GUI. Remote scripting, MAM integration, and network access are Studio-only. S/NC can support Resolve Free users via EDL/AAF interchange (manual import/export) but cannot automate the workflow.

**Resolve Studio** ($295 one-time perpetual) unlocks the scripting API (Python/Lua), network media access, and MAM integration. This enables scripted project creation, programmatic media import, render queue automation, and metadata exchange (markers, timelines, color grades). Still no headless rendering — Studio scripting requires a running GUI instance.

**S3 media access for Resolve (Free or Studio):** Since Resolve can't open HTTP URLs as media sources, the practical solution is rclone mount with VFS caching. This presents the S3 bucket (Garage) as a local filesystem via FUSE. Resolve sees a regular drive, rclone handles streaming and caching. Cross-platform (Linux, macOS, Windows). For large 4K+ footage, rclone's VFS cache keeps frequently accessed files local for smooth playback.

## Media URL Strategy

### Redirect Endpoint Pattern

S3 presigned URLs expire — a problem for multi-hour or multi-day editing sessions. Rather than generating long-lived presigned URLs (which leak access tokens in project files), the platform serves stable redirect endpoints:

```
https://s-nc.org/media/{id}/stream  →  302  →  fresh presigned S3 URL
```

- **No expiry concern** — a fresh presigned URL is generated on each request
- **No long-lived tokens in project files** — the stable URL is the only reference stored
- **FFmpeg follows redirects natively** — MLT/Kdenlive/Shotcut work without modification
- **Auth layering** — session token, API key, or other auth can be applied to the stable URL
- **Works for any HTTP-redirect-aware client** — not limited to MLT

For tools that can't do HTTP URLs at all (Resolve), rclone mount is the access path (see DaVinci Resolve section above).

## Project Interchange Format

### Decision: Direct MLT XML + EDL Generation

The platform generates project files directly in Node.js — no OTIO intermediary, no Python dependency.

- **MLT XML** for Kdenlive and Shotcut — well-documented XML format, media references use the redirect endpoint URLs
- **EDL** for DaVinci Resolve — simple text format (timecodes + source references), trivial to generate in any language
- **Review comments** exported as timeline markers in both formats

### Why Not OTIO?

OpenTimelineIO (Pixar's open timeline interchange standard, Apache 2.0, ASWF-governed) is a capable universal interchange format with mature Python bindings (v0.18.1) and adapters for EDL, AAF, FCP XML, Premiere XML, Resolve, and MLT XML. However:

- The immediate targets are only MLT XML + EDL — two formats, both straightforward to generate directly
- OTIO requires Python bindings (JS bindings are experimental/not production-ready)
- Adding a Python runtime dependency for two simple formats is unnecessary complexity

**OTIO remains the right choice if** S/NC later needs to support FCP XML, AAF, Premiere XML, or other interchange formats. At that point, adding OTIO via `child_process.spawn()` (calling Python scripts per operation) is the pragmatic approach — no sidecar needed at S/NC's scale.

## Integration Patterns (Build Levels)

Integration depth varies by tool. Every creator gets Level 1 regardless of their NLE.

### Level 1: Media Hub (MVP) — all tools
- S3 upload/download with presigned URLs
- Web review with timestamped comments (Vidstack player + comment overlay)
- FFmpeg transcoding for web playback
- **No NLE-specific integration** — creators manually download source files, edit locally, upload renders
- Resolve users: download media locally or mount S3 via rclone

### Level 2: Project File Generation — tool-specific depth
- Platform generates **MLT XML** (for Kdenlive/Shotcut) and **EDL** (for Resolve) with media URLs pointing to the redirect endpoint
- **Kdenlive/Shotcut:** Creator downloads project file → opens in NLE → media loads from platform via HTTP redirect URLs
- **Resolve:** Creator imports EDL with markers; media loaded from local storage or rclone-mounted S3. Resolve Studio enables scripted EDL import.
- Review comments exported as timeline markers in both formats
- **Key value:** Review feedback appears directly in the editor. This is Frame.io's highest-value feature.

### Level 3: Proxy Workflow — all tools benefit, automation varies
Standard in professional post-production (offline/online editing):
1. Creator uploads original footage → platform stores in S3
2. Platform auto-generates 720p H.264 proxy via FFmpeg
3. **Kdenlive/Shotcut:** Download proxy + MLT XML project file → edit with lightweight proxies → platform substitutes originals for publish via path substitution
4. **Resolve:** Download smaller proxy files for editing → upload EDL back → platform resolves against originals

**Path substitution in MLT XML** is straightforward string replacement in `<property name="resource">` elements. Proxy filenames follow a convention (e.g., `original-name_proxy.mp4`).

### Level 4: Cloud Render — MLT editors only
- Creator uploads MLT XML project file → server resolves media references → renders with `melt` CLI → publishes
- **Validated concept:** Pasolino (web interface for remote melt rendering) demonstrates this works, though its implementation is not directly reusable
- **Limitations:** Effect/plugin compatibility (must match server's MLT plugin set), font availability, GPU effects fall back to software rendering
- **Scope:** Limited to MLT-based projects (Kdenlive + Shotcut). Not available for Resolve — no headless rendering even with Studio.

## Existing Open-Source Reference

### Clapshot
Self-hosted video review platform. Most relevant open-source reference for S/NC's review features.
- Rust server + Svelte client + FFmpeg transcoding + gRPC plugin system + timecoded annotations
- v0.9.2, 225 stars, GPLv2
- Good architectural reference for review comment → timeline marker bridge

### Frame.io (Proprietary Reference)
Industry leader in collaborative video review. Key pattern to replicate:
- Timestamped comments on video frames
- Annotations/drawings on frames
- Comments sync to NLE timeline as markers (via NLE plugins for Premiere, Resolve, FCP)
- Approval workflows (approved / needs changes)
- Version comparison

S/NC can replicate the comment → marker flow via OTIO markers in generated project files. No plugin needed — just include markers in the downloaded project file.

## What S/NC Would Build

| Level | New Code | Dependencies | Effort |
|-------|----------|-------------|--------|
| **Level 1** | Timestamped comment model + UI, redirect endpoint for media URLs | Vidstack (already planned) | Small |
| **Level 2** | MLT XML + EDL generator (Node.js), marker export | None beyond Node.js XML library | Medium |
| **Level 3** | Proxy generation FFmpeg job, path substitution logic | FFmpeg pipeline (already planned) | Medium |
| **Level 4** | melt render service, MLT plugin management | melt CLI on server | Large |

Levels 1-2 are the highest value-to-effort ratio. Level 3 becomes important when creators work with large 4K+ footage. Level 4 is ambitious and should be evaluated after Levels 1-3 are proven.

### Tool-Specific Integration Summary

| Capability | Kdenlive/Shotcut | Resolve Free | Resolve Studio |
|-----------|-----------------|-------------|---------------|
| Upload/download media via S3 | Yes | Yes | Yes |
| S3 media access method | HTTP redirect URLs (native) | rclone mount | rclone mount or scripted import |
| Web review with timestamped comments | Yes | Yes | Yes |
| Project file with media URLs | Yes (MLT XML) | No | Via scripted import |
| Review comments as timeline markers | Yes (MLT XML markers) | Yes (EDL import) | Yes (scripted EDL import) |
| Proxy workflow | Automated (MLT path substitution) | Manual download | Scriptable |
| Cloud render | Yes (melt CLI) | No | No (no headless) |

## Strategic Context

This integration approach means S/NC doesn't compete with desktop NLEs — it makes them better by adding collaboration, storage, and delivery. Creators use their preferred tool (Kdenlive, Shotcut, Resolve, Blender), and the platform handles everything around the creative work.

The same model applies to audio production (see `audio-production-tools.md`): DAWs handle recording/mixing/mastering, the platform handles stem exchange, review, and publish.

See also:
- `video-editing-tools.md` — browser-side editing tools and timeline UI libraries
- `video-codec-compatibility.md` — codec support driving transcoding decisions
- `media-player-libraries.md` — Vidstack player for review playback
