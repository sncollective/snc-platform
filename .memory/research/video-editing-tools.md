---
updated: 2026-04-16
---

# Video Editing & Collaboration Tools (March 2026)

Evaluated for the S/NC web platform — a platform cooperative for media production. Grounded in existing stack decisions: FFmpeg (direct CLI via child_process) for server-side processing, pg-boss job queue, Vidstack player, Garage S3 storage, Hono v4 API + TanStack Start (React 19), H.264+AAC delivery format.

## Use Cases (Tiered)

1. **VOD clipping** — trim a live stream recording into a publishable clip
2. **Basic editing** — trim, cut, concatenate, text overlays, transitions
3. **Advanced editing** — multi-track timeline, audio mixing, color grading, effects
4. **Collaboration** — multiple people editing the same project

## Browser-Side Video Processing

### WebCodecs API
Low-level browser API for frame-by-frame video decode/encode. W3C standard.

- **Support:** Chrome 94+, Firefox 130+, Edge, Safari 16.4+ (partial)
- **What it enables:** Frame-level access for real-time preview, thumbnail generation, scrubbing. Foundation for any in-browser editing preview pipeline.
- **What it doesn't do:** No muxing, no UI, no editing logic. It's a building block, not a solution.
- **License:** Web standard, no licensing concern.

### FFmpeg.wasm (@ffmpeg/ffmpeg)
FFmpeg compiled to WebAssembly, runs in the browser.

- **Performance:** 3-10x slower than native FFmpeg. CPU-only (no hardware acceleration).
- **Limitations:** ~2GB memory ceiling, ~30MB download size.
- **Use cases:** Lightweight client-side utilities (format probing, thumbnail extraction, small clips). Not viable for rendering full edits.
- **License:** GPL/LGPL (inherited from FFmpeg). Must be careful about distribution and linking.
- **Verdict:** Useful for quick previews and probing, not for real rendering. Server-side FFmpeg remains the render engine.

### WebGPU
GPU-accelerated compute in the browser. All major browsers as of November 2025.

- **Performance:** ~8-9ms/frame for video effects processing.
- **Use case:** Real-time preview pipeline: WebCodecs decode → WebGPU effects → Canvas display.
- **Verdict:** Critical for any editing preview that includes effects or color grading. Not needed for simple trim/clip workflows.

## Timeline / Editor UI Libraries

| Library | License | React? | Maturity | Notes |
|---------|---------|--------|----------|-------|
| **react-timeline-editor** | MIT | Yes | Basic, stable | Simple timeline component. Good starting point for custom builds. |
| **Twick** | Sustainable Use License | Yes (SDK) | Early (launched 2025) | Most promising React editor SDK — timeline, canvas, drag-drop. License is non-OSI but cooperative-friendly. Watch closely. |
| **Movie Masher** | MPL-2.0 | Yes | Low activity (last Mar 2024) | Full client + server architecture with FFmpeg rendering. Cooperative-friendly license. Abandonment risk. |
| **Remotion** | Source-available (restrictive) | Yes | Mature | Programmatic video creation, NOT an editor UI. Company license required for orgs >3 people. **Avoid as foundation** — license incompatible with cooperative values. |
| **RVE/DesignCombo** | Proprietary | — | — | Restrictive license. Avoid. |
| **IMG.LY** | Proprietary | — | — | Commercial video editor SDK. Avoid. |
| **MLT Framework** | LGPL-2.1 | No (C/C++) | Mature | Powers Kdenlive and Shotcut. Supports headless server rendering via `melt` CLI. Could serve as alternative render backend for complex compositions alongside FFmpeg. |

**Assessment:** No single library is both production-ready and fully open-source for a cooperative. The realistic path is custom-built timeline UI (starting from react-timeline-editor or from scratch) with FFmpeg as the render backend.

## Edit Decision Lists / Project Formats

### OpenTimelineIO (OTIO)
Pixar's open standard for editorial timeline interchange. Apache 2.0, governed by Academy Software Foundation (ASWF).

- **Format:** JSON-native. Data model: Timeline → Track → Clip → MediaReference.
- **Adapters:** Import/export EDL, AAF, FCP XML, Premiere XML, Resolve.
- **JS bindings:** Experimental (opentimelineio-js). Python bindings are mature.
- **Recommendation:** Design our JSON edit schema using OTIO's data model concepts. Store in PostgreSQL as JSONB. Use Python OTIO server-side for professional format import/export (round-trip to DaVinci Resolve, Kdenlive, etc.).

### Custom Edit Schema (for S/NC)
```
Project
  └─ Timeline
       └─ Track[] (video, audio, text)
            └─ Clip[] (mediaRef, sourceIn, sourceOut, timelineOffset, effects[])
                 └─ MediaReference (storageKey, codec, duration, resolution)
```
Store as JSONB in a `projects` table. Render via FFmpeg `filter_complex` from this schema.

## Collaboration

### Industry Standard: Async Review (Frame.io Model)
Frame.io (acquired by Adobe) established the model: timestamped comments on video frames, annotations/drawings on frames, approval workflows (approved/needs changes), version history with comparison.

**This is what the industry actually uses.** Real-time co-editing of video timelines does not exist in production anywhere.

### Real-Time Co-Editing
- **No known CRDT or OT implementations exist for video timelines.**
- The data model (timeline of clips with in/out points, effects, transitions) is complex enough that conflict resolution is a research problem, not an engineering one.
- **Recommendation:** Defer indefinitely. Build async review first.

### Recommended Collaboration Tiers
1. **Timestamped comments** — viewers/collaborators add comments at specific timestamps. Simple to build (comment table with `timestamp` column + Vidstack time sync).
2. **Frame annotations** — draw on video frames. Needs a canvas overlay on the player. More complex but high-value for review workflows.
3. **Approval workflows** — status per version (draft → review → approved → published). Fits naturally with the content table's existing `publishedAt` + proposed `processingStatus`.
4. **Shared projects with locking** — multiple editors, one at a time (pessimistic locking). Simple but prevents conflicts.
5. **Presence awareness** — see who's viewing/editing. WebSocket or SSE. Nice to have, not essential.
6. **Real-time co-editing** — research problem. Don't attempt.

## Server-Side Rendering

### FFmpeg (already decided)
FFmpeg CLI (via thin in-house wrapper — fluent-ffmpeg is archived). Handles: trim, concat, filter_complex (compositing, overlays, transitions, color correction), HLS segmentation, thumbnail extraction.

For basic editing, `filter_complex` can render a full edit from an edit schema:
```
ffmpeg -i clip1.mp4 -i clip2.mp4 -filter_complex "[0:v]trim=10:20[v1];[1:v]trim=5:15[v2];[v1][v2]concat=n=2[outv]" -map "[outv]" output.mp4
```

### MLT Framework (future consideration)
Powers Kdenlive and Shotcut. Headless rendering via `melt` CLI. Better than raw FFmpeg for complex multi-track compositions with effects, transitions, and audio mixing. LGPL-2.1. Could complement FFmpeg for advanced editing use cases.

### Hosted APIs (avoid)
Shotstack, Creatomate, JSON2Video — hosted rendering APIs. Create vendor dependency and per-render costs. Counter to cooperative values.

Remotion Lambda — serverless rendering tied to AWS. Restrictive license (not OSI open-source). Avoid.

## Recommendations by Tier

### Tier 1: VOD Clipping (immediate, no new dependencies)
- **UI:** Vidstack player + custom range selector (in/out point markers)
- **Data:** Simple JSON: `{ sourceId, startTime, endTime, title }`
- **Render:** FFmpeg `stream copy` (no re-encoding if same codec) or transcode via FFmpeg CLI
- **Queue:** pg-boss job
- **Result:** New content item with `sourceType: "stream-recording"`, linked to source VOD
- **Effort:** Small — builds directly on the media pipeline foundation

### Tier 2: Basic Editing (medium scope)
- **UI:** Custom timeline component (start from react-timeline-editor or build from scratch)
- **Preview:** WebCodecs API for frame-accurate scrubbing
- **Data:** OTIO-inspired JSON schema in PostgreSQL JSONB
- **Render:** FFmpeg `filter_complex` via FFmpeg CLI, queued through pg-boss
- **Features:** Trim, cut, concatenate, text overlays, basic transitions
- **Effort:** Significant — custom UI work is the biggest investment

### Tier 3: Advanced Editing (large scope)
- **UI:** Full multi-track timeline (likely fully custom-built)
- **Preview:** WebCodecs decode → WebGPU effects → Canvas display
- **Render:** FFmpeg for most operations, possibly MLT for complex compositions
- **Data:** Full OTIO-compatible project format, export to DaVinci Resolve / Kdenlive
- **Features:** Multi-track, audio mixing, color grading, effects, transitions
- **Effort:** Very large — this is building an NLE (non-linear editor)

### Tier 4: Collaboration (additive to any tier)
- **Phase 1:** Timestamped comments + approval workflows (works with Tier 1)
- **Phase 2:** Frame annotations (works with Tier 1-2)
- **Phase 3:** Shared projects with locking (works with Tier 2-3)
- **Phase 4:** Presence awareness (works with Tier 2-3)
- Real-time co-editing: defer indefinitely

## Key Insight for S/NC

The cooperative's differentiator isn't building a better NLE — DaVinci Resolve (free), Kdenlive (open source), and Shotcut (open source) exist. The differentiator is the **platform integration**: VOD clipping from live streams, review/approval workflows for collaborative media production, and a publish pipeline that handles transcoding and delivery. Focus the editing scope on platform-integrated workflows (Tiers 1-2 + collaboration Phase 1-2), not on competing with desktop NLEs.

## References

- WebCodecs: https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API
- OpenTimelineIO: https://opentimeline.io
- react-timeline-editor: https://github.com/xzdarcy/react-timeline-editor
- Twick: https://twick.dev
- Movie Masher: https://moviemasher.com
- MLT Framework: https://www.mltframework.org
- Frame.io collaboration model: https://frame.io
