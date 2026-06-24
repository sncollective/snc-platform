---
title: "Clip Extraction Stack — Technical Mechanics"
campaign: stream-clipping-twitch-parity
specialist_facet: clip-extraction-stack
provenance: agent-synthesis
updated: 2026-06-24
research_handles:
  - srs-v6-dvr-doc
  - srs-v6-hls-doc
  - srs-v6-http-callback-doc
  - srs-src-v6
  - srs-fullconf-source
  - srs-v6-http-api-doc
  - srs-platform-conf
  - ffmpeg-main-seeking-copy
  - ffmpeg-codecs-gop
  - ffmpeg-formats-hls-segment
  - platform-content-schema
seam: viewer-ugc-product (permissions/attribution/discovery/moderation), clipping-comparators (competitor feature sets)
---

# Clip Extraction Stack — Technical Mechanics

This brief covers the extraction mechanics for stream/VOD clipping on the SNC platform stack:
live-edge vs VOD clipping, SRS capabilities, FFmpeg stream-copy vs transcode tradeoffs, the
clip data model, and the host-level vs in-pipeline architecture question.

---

## 1. Live-Edge vs VOD Clipping — Latency Floor and What Determines It

### The HLS rolling buffer (live-edge clipping)

SRS converts the incoming RTMP stream to HLS with `hls_fragment 2` (2-second segments) and
`hls_window 10` (10-second rolling window) [srs-platform-conf]{1}. During a live stream,
approximately 5 segments are kept on disk at any moment; segments older than 10 seconds are
deleted [srs-v6-hls-doc]{1}. This means:

- The **live-edge latency floor** for clipping from HLS segments is determined by `hls_window`:
  the earliest in-point a live-edge clip can reference is ~10 seconds ago. After `hls_window`
  seconds elapse, segments are gone.
- The live-edge clip window is not a recording — it is ephemeral. A clip extracted from live
  HLS segments must be extracted while the segments still exist on disk, within the rolling
  window.
- At the minimum tunable `hls_fragment 2` (already at a low-latency setting), each segment
  is 2 seconds. The practical **earliest possible clip** from the live edge would be: *now minus
  hls_window* = at most 10 seconds of reachable past content.

**Critical gap:** The platform's current SRS config does **not** enable DVR [srs-platform-conf]{2}.
Without DVR, there is no persistent recording from which to extract a VOD clip after the stream
ends. The HLS window is not a recording — it evaporates.

### DVR-based VOD clipping

SRS DVR writes the stream to disk as a file (FLV or MP4, controlled by `dvr_path` extension).
With `dvr_plan session`, a single file is written for the entire publish session, closed on
unpublish [srs-v6-dvr-doc]{1}. With `dvr_plan segment`, files are split by `dvr_duration`
(default 30s) + keyframe alignment [srs-v6-dvr-doc]{2}. The `on_dvr` callback fires when a
file is finalized, delivering the file path [srs-v6-dvr-doc]{3}.

**VOD clip latency** from DVR depends on plan:
- `session` plan: the full DVR file is not available until the stream ends (on_dvr fires on
  unpublish). No mid-stream VOD clipping is possible from a session-plan DVR file.
- `segment` plan: a new file segment is finalized every `dvr_duration` seconds. A VOD clip
  can be extracted from finalized segments while the stream is still live, with a lag of
  `dvr_duration` seconds plus the time to close the segment on a keyframe.

### The latency floor summary

| Mode | Earliest in-point | Persistence | Requires |
|---|---|---|---|
| Live HLS segments | ~10s ago (hls_window) | Ephemeral — deleted after window | No config change (HLS already on) |
| DVR session | After stream ends | Persistent until deleted | DVR enabled, session plan |
| DVR segment | After each segment closes (~30s lag default) | Persistent per segment | DVR enabled, segment plan |

The HLS window is the only live-edge buffer today, but it is not designed as a clip buffer —
it is a delivery window. It could be stretched (increase `hls_window`), but segments still
evaporate. DVR is the correct substrate for any clip that needs to outlive the HLS window.

---

## 2. SRS Capabilities for Clip Extraction

### HLS segment files on disk

SRS writes `.ts` segment files to `hls_path/[app]/[stream]-[seq].ts` (default
`/usr/local/srs/objs/nginx/html/[app]/[stream]-[seq].ts`) and serves them via its HTTP server
on port 8080 [srs-v6-hls-doc]{1}. The files are accessible:
- As local filesystem paths (from a process co-located with SRS on the host)
- Via HTTP from the SRS HTTP server (served under `/[app]/[stream]-[seq].ts`)

The `on_hls` callback fires when each segment is written [srs-v6-http-callback-doc]{1}, but
its exact payload fields (file path, duration, sequence number) were not confirmed from the
fetched documentation summary.

### DVR files on disk

When DVR is enabled, SRS writes FLV or MP4 files at `dvr_path`. The `on_dvr` callback fires
when each file is finalized and delivers the `file` path (absolute or relative) and `cwd`
[srs-v6-dvr-doc]{3}. Runtime DVR enable/disable via the RAW API was referenced in the SRS docs
as issues #319/#459 but the specific endpoint was not confirmed from the fetched content
[srs-v6-dvr-doc]{4}. The general RAW API in SRS v6 is restricted to config query and reload
[srs-v6-http-api-doc]{1}.

### SRS HTTP API — what it exposes for clip timing

The SRS HTTP API (port 1985) provides stream metadata via `/api/v1/streams` but does not
expose timestamps, stream duration, segment lists, or DVR progress [srs-v6-http-api-doc]{2}.
The `startedAt` timestamp for timing calculations must come from the platform's own
`streamSessions` table (which records `startedAt` at `on_publish`) [platform-content-schema]{1}.

### SRS transcode engine

SRS can invoke FFmpeg via its transcode block (`vcodec copy` for passthrough, `vcodec libx264`
for re-encode) [srs-fullconf-source]{1}. The platform's SRS config does not use the transcode
block — clip extraction would be done by the platform pipeline calling FFmpeg directly, not
through SRS's transcode engine.

---

## 3. FFmpeg Stream-Copy vs Transcode for Clip Extraction

### Stream-copy mechanics

`-c copy` copies packets without decode/encode — "no quality loss" and "very fast"
[ffmpeg-main-seeking-copy]{1}. For H.264+AAC content (the platform's delivery codec), the
codecs match across source and clip, so stream-copy is the natural approach.

**Seeking with stream-copy:**

FFmpeg `-ss` placement determines precision:

- **Input-side seek** (`ffmpeg -ss 00:01:23 -i input.mp4 -to 00:01:53 -c copy output.mp4`):
  FFmpeg seeks to the nearest keyframe *before* the target position. With stream-copy, the
  extra segment between that keyframe and the target position is **preserved** (not discarded)
  [ffmpeg-main-seeking-copy]{2}. The clip starts from the keyframe preceding the in-point,
  not from the exact in-point — meaning the clip may be slightly longer than requested and
  will start from an earlier keyframe.

- **Output-side seek** (`ffmpeg -i input.mp4 -ss 00:01:23 -to 00:01:53 -c copy output.mp4`):
  FFmpeg decodes and discards packets until timestamps reach the position [ffmpeg-main-seeking-copy]{3}.
  With stream copy (no decode), "output-side seek" still copies all packets from the keyframe;
  the practical behavior is the same as input-side seek for stream copy.

**The keyframe/GOP alignment limitation (confirmed):**

Stream-copy can only start a playable clip at a keyframe. If the requested in-point falls
between keyframes, the clip either: (a) starts from the preceding keyframe (slightly early) or
(b) starts from a non-keyframe packet that will play as corrupted/grey frames until the next
keyframe within the clip. The former is the typical behavior of input-side `-ss` with
`-c copy`.

The frame-accuracy of the boundary therefore depends on the keyframe interval (GOP size). The
generic FFmpeg default GOP is 12 frames [ffmpeg-codecs-gop]{1}. At 30 fps, GOP=12 → keyframe
every ~0.4 seconds; this gives at most ~0.4s of boundary imprecision with stream-copy. At
common streaming GOP sizes (2–4 seconds, set by OBS or encoder presets), imprecision is
2–4 seconds.

### Transcode for frame-accurate cuts

For frame-accurate in/out points, `-c:v libx264` (transcode) must be used. FFmpeg's
`-accurate_seek` (enabled by default with transcode) decodes and discards from the keyframe to
the exact in-point, then re-encodes from there [ffmpeg-main-seeking-copy]{4}. This is
significantly more CPU-intensive than stream-copy but produces exact boundaries.

A hybrid approach exists: use stream-copy for the main body if the in/out are keyframe-aligned,
or apply a short transcode only at the boundary frames. This requires knowing keyframe positions
in advance (e.g., from `ffprobe`).

### The `-force_key_frames` option

If the platform controls encoding (e.g., a re-encode step after upload), keyframes can be
forced at specific timestamps [ffmpeg-main-seeking-copy]{5}. However, for content uploaded by
creators or ingested from RTMP, keyframe positions are not under platform control.

### Practical recommendation from the source evidence

For H.264+AAC clip extraction where exact frame accuracy is not critical (e.g., ±0.5–2s
acceptable at typical streaming GOP sizes):
```
ffmpeg -ss <in_seconds> -i <source> -to <out_seconds> -c copy -avoid_negative_ts 1 <output.mp4>
```
For frame-accurate boundaries:
```
ffmpeg -ss <in_seconds> -i <source> -to <out_seconds> -c:v libx264 -c:a copy <output.mp4>
```

---

## 4. Clip-as-Content-Item Data Model

### What the existing content table provides

The `content` table is the platform's universal content item [platform-content-schema]{1}. A
clip is structurally a video content item: it has `type: "video"`, a `mediaKey` (the clip file
in Garage), a `thumbnailKey`, `duration`, and `creatorId`. The `processingStatus` lifecycle
(`uploaded → processing → ready | failed`) fits clip extraction well.

The processing pipeline infrastructure (`processingJobs` table, `processing-jobs.ts` service
with `downloadToTemp` / `uploadFromTemp` / `createJob` / `updateJob`) is directly reusable
[platform-content-schema]{2}. A new `ProcessingJobType` value (e.g., `"clip-extract"`) would
be dispatched via pg-boss using the existing pattern.

### What is new (not in the existing schema)

The existing schema does **not** have:
1. A link from a clip content item to its **source** (stream session or VOD content item)
2. **In/out offsets** (seconds from stream start or VOD start)
3. A `sourceType` value of `"clip"` (current `SOURCE_TYPES` are `upload` and any streaming
   variants, not clip-derived)

A minimal extension would add to the `content` table (or a new `clip_metadata` join table):
- `clipSourceType: "stream" | "vod"` — whether clipped from a live stream or a VOD
- `clipSourceId: text` — references `streamSessions.id` or `content.id` (source VOD)
- `clipInOffset: real` — seconds from stream/VOD start
- `clipOutOffset: real` — seconds from stream/VOD start

The `streamSessions` table already has `startedAt` [platform-content-schema]{3}, enabling
wall-clock-to-offset conversion for live clips (e.g., if a viewer marks a live moment at
`clipWallTime`, offset = `clipWallTime - session.startedAt`).

---

## 5. Architecture Question — Host-Level vs In-Pipeline Extraction

### The fundamental question

Clip extraction can happen:

**A. In-pipeline (pg-boss job → API worker → FFmpeg subprocess → Garage upload)**
- Follows the existing `processingJobs` pattern exactly (same as `vod-remux` and `transcode`
  jobs).
- Requires the source file to be accessible to the API worker: either downloaded from Garage
  (for VOD clips from uploaded/remuxed content) or accessed on a shared filesystem (for clips
  from SRS DVR recordings).
- Works natively for VOD clips where `mediaKey` points to a Garage object.

**B. Host-level (FFmpeg on Proxmox host reading SRS DVR files directly)**
- Avoids a round-trip through Garage (DVR file stays on host disk → FFmpeg reads directly →
  uploads to Garage).
- Relevant specifically for clips from SRS DVR recordings, where the SRS container writes
  files to a host-mounted volume.
- Requires either the API worker to have access to the same host-mounted path, or a separate
  host-level process (shell script / sidecar) that the API triggers.

### Source-grounded analysis

The platform's current processing service (`processing-jobs.ts`) uses `downloadToTemp` to
pull a file from Garage, then runs FFmpeg locally, then uploads back to Garage
[platform-content-schema]{2}. This pattern works for any source that is already in Garage.

For live-stream VOD clips, the source file would be the SRS DVR recording (if DVR is enabled).
The DVR file lives inside the SRS Docker container's filesystem, at a path like
`/usr/local/srs/objs/nginx/html/live/stream.1234.mp4`. Two access paths exist:
1. Mount a host volume into the SRS container for DVR output, and also mount that same
   path into the API container — then the API worker can read the DVR file directly without
   downloading from Garage.
2. When the `on_dvr` callback fires (delivering the file path), the API uploads the DVR file
   to Garage as a VOD source, then future clips can be extracted from Garage.

**Option 2 is the lower-risk integration:** it reuses the existing download→FFmpeg→upload
pipeline, and the DVR file's lifecycle is handed off to Garage immediately on stream end
(or on segment close for `segment` plan). This is how the `vod-remux` job type likely works —
the VOD is in Garage, FFmpeg remuxes it, uploads the result.

**Option 1 (shared host volume) is lower latency** for segment-plan DVR clips because there
is no Garage upload intermediate step — but it couples the clip worker to the host filesystem
layout, and adds a shared-volume dependency between containers.

### DVR is the prerequisite

Both options require DVR to be enabled in SRS, which is currently absent from the platform
config [srs-platform-conf]{2}. Enabling DVR requires:
1. Adding a `dvr { enabled on; dvr_plan session|segment; dvr_path ...; }` block to `srs.conf`
2. Handling the `on_dvr` callback (add to `http_hooks` in SRS config + route in the API)
3. Deciding where DVR files are stored (container-local, host-mounted volume)

---

## Contradictions

No direct contradictions between sources on the core mechanics. One area of tension:

**FFmpeg generic default `-g 12` vs streaming practice:** The FFmpeg codecs doc confirms a
default GOP of 12 frames [ffmpeg-codecs-gop]{1}. However, RTMP streaming encoders (OBS,
XSplit, hardware encoders) commonly use 2–4 second keyframe intervals by convention, not
FFmpeg's generic 12-frame default. The boundary imprecision for stream-copy clip extraction
therefore depends on the **sender's** encoder configuration, not FFmpeg's default. The libx264
section was truncated in the fetched content, so libx264's own keyint default is unconfirmed
from a fetched source. The practical range (2–4s for streamers) is a training-data inference
that I have not attested — I flag it here but have not cited it.

---

## Disconfirming analysis

**Does SRS's HTTP API expose any clip-relevant timing that would reduce the need for
platform-side tracking?** The API exposes stream objects with a `publish.cid` field but no
`startedAt`, duration, or segment-level timestamps [srs-v6-http-api-doc]{2}. This is
disconfirming for the hypothesis that SRS alone could provide the timing anchor — the platform
must maintain its own timing in `streamSessions.startedAt`.

**Does the HLS rolling window provide a viable live-edge clip source without DVR?** In
principle yes — `.ts` segment files exist on disk within `hls_window` seconds. But the window
is 10 seconds [srs-platform-conf]{1}, which limits clip in-points to ≤10 seconds ago. Longer
clips or any clip initiated after a moment passes the window are not possible without DVR. This
disconfirms the hypothesis that HLS alone is sufficient for a general live-clip feature.

**Does stream-copy always produce valid output with `-ss`?** When the in-point is not on a
keyframe, the preserved extra segment means the clip starts with decodable-but-visually-wrong
frames until the next keyframe [ffmpeg-main-seeking-copy]{2}. This disconfirms "stream-copy is
always sufficient" — it is sufficient only when boundaries are keyframe-aligned OR when
≤GOP-size boundary imprecision is acceptable.

---

## Revisit if

- SRS v6 documents a DVR RAW API endpoint that enables per-stream runtime DVR control (issues
  #319/#459 referenced but endpoint not confirmed in fetched docs).
- The `on_hls` callback payload is confirmed to include the segment file path and sequence
  number — which would enable live-segment clip extraction triggered by the callback rather
  than by polling.
- The platform adopts LL-HLS (SRS v6 does not implement LL-HLS per `srs-v6-hls-doc`) —
  which would change the live-edge latency floor significantly.
- Creator encoder conventions are established (platform-recommended OBS settings) — allowing
  the platform to control keyframe interval at the sender, making stream-copy boundary
  imprecision predictable.
- A probing step (`ffprobe`) is added to the clip pipeline to locate actual keyframe
  positions, enabling smart boundary snapping before FFmpeg is called.
