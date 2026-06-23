---
source_handle: openshot-qt-releases
fetched: 2026-06-23
source_url: https://www.openshot.org/blog/2026/04/06/openshot-351-faster-performance-smoother-editing-better-previews/
provenance: source-direct
---

## Summary

Official OpenShot release notes for version 3.5.1 (April 6, 2026) — the latest stable release as of this engagement. Documents new features including a built-in proxy ("Optimize Preview") workflow.

## Key Passages

### Optimize Preview (Proxy Workflow)

The headline new feature:

> "a new built-in proxy workflow that creates or links optimized preview media for smoother playback, scrubbing, trimming, and editing on demanding footage."

This is OpenShot's first native proxy workflow. Prior versions had no built-in proxy support.

### Performance Improvements

CPU-aware thread defaults, better thread controls, faster media inspection.

### Timeline Editing

Improved zooming, playhead-centered zoom behavior, smoother interaction, better multi-selection trimming.

### AI Features

Depth and Lines extraction workflows added, expanded ComfyUI integration.

### Interface

New "User Interface Scale" preference for display adaptation.

### Notable Absences from Release Notes

The 3.5.1 release notes make **no mention** of:
- OTIO (OpenTimelineIO) support
- CLI/headless rendering
- HTTP URL media sources
- New import/export formats beyond prior capability

### Project File Format (.osp)

The `.osp` format is JSON-based. File paths within projects are stored as **relative paths** (from earlier documentation fetch). Imported media files are not copied into the project folder — they remain at their original location.

## From OpenShot 3.4 Release Notes (December 2025)

Version 3.4 focused on:
- ~32% overall performance improvement in internal benchmarks
- New visual effects (Sharpen, Color Map/LUT, Spherical Projection, Lens Flare, Outline)
- Final Cut Pro XML (v4/v5) improved round-trip with motion/keyframes
- Enhanced EDL compatibility
- **No mention of OTIO or headless render**

## Structural Metadata

- **Latest version**: 3.5.1 (April 6, 2026)
- **License**: GPL-3.0
- **Project format**: JSON (.osp), relative file paths
- **Proxy support**: Added in 3.5.1 ("Optimize Preview")
- **OTIO**: Not supported (absent from 3.4 and 3.5.1 release notes)
- **Headless render**: Not documented in any release notes reviewed
