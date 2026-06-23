---
source_handle: blender-vse-otio-status
fetched: 2026-06-23
source_url: https://github.com/tin2tin/VSE_OTIO_Export
provenance: source-direct
---

## Summary

Community OTIO integration status for Blender VSE, compiled from search evidence across: the tin2tin/VSE_OTIO_Export GitHub addon, the Blender Projects PR #158562 (WIP VSE OTIO export), Blender Studio blog, and a 2025-2026 Blender Artists thread discussing updating the addon for Blender 5.

## Key Passages

### Community Addon (VSE_OTIO_Export)

Description: "Export .otio from the Blender Video Sequence Editor(VSE) using OpenTimelineIO which is useful because Davinci Resolve supports import of .otio files."

This is a third-party addon, not built-in Blender functionality.

### Blender Projects PR #158562 (WIP)

A work-in-progress pull request titled "VSE: Export OpenTimelineIO (.otio)" exists on the Blender project tracker. As of search evidence from June 2026, it had not been merged into a stable release. The PR is categorized as WIP.

### Native Blender OTIO Status

Blender Studio experimented with OTIO in 2021 via a third-party addon (vse_io). The developer forum project ideas page lists VSE OTIO import/export as a project goal, indicating it is not yet built-in.

A 2025–2026 Blender Artists thread titled "VSE OTIO export - updating for Blender 5" discusses the need to update the addon because "Blender 5 has made some fundamental changes to sequence naming" — confirming OTIO support remains addon-dependent as of Blender 4.x/5.x development.

### Blender 4.3 and 4.4 VSE Features (from search evidence)

Neither release added OTIO support. Notable VSE improvements:
- 4.3: Multi-threaded video proxy downscaling, faster thumbnails.
- 4.4: Faster proxy building for image sequences, H.265/HEVC codec support.

### Headless Render via `blender -b`

Multiple established approaches exist for headless VSE rendering:
- `blender -b <file.blend> -a` renders the animation.
- Python scripting via `blender -b <file.blend> --python <script.py>` for custom render automation.
- Third-party tools: "Pulverize" (multi-process VSE render), "the-video-editors-render-script-for-blender" (cross-platform multicore render script), "Blenderless" (Python package for headless Blender rendering).

### HTTP/URL Media Support in VSE

Not documented. Blender VSE is file-based; no evidence of native HTTP URL media source support found.

### Proxy Support in Blender VSE

Blender VSE has native proxy support. Documentation confirms proxy generation (multiple sizes), with Blender 4.3+ adding multi-threaded proxy downscaling. The GDQuest blender-proxies-generator tool provides a command-line proxy generation workflow using FFmpeg. Final render uses original media.

## Structural Metadata

- **Project format**: Blender `.blend` file (binary, Blender-native)
- **OTIO**: Addon only (VSE_OTIO_Export / vse_io); not built-in in any stable Blender release; WIP PR exists
- **Headless render**: Yes, via `blender -b`
- **HTTP media**: Not supported
- **Proxy**: Native, with multi-threaded generation in 4.3+
- **License**: GPL-2.0+
