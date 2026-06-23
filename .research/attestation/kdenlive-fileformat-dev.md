---
source_handle: kdenlive-fileformat-dev
fetched: 2026-06-23
source_url: https://github.com/KDE/kdenlive/blob/master/dev-docs/fileformat.md
provenance: source-direct
---

## Summary

Developer documentation for the Kdenlive project file format. Documents the XML structure (based on MLT XML), format generations, key properties including proxy-related fields, and media reference conventions.

## Key Passages

### File Format Overview

> "Kdenlive projects use XML format based on MLT (Media Manipulation Library), storing media references rather than the media itself."

The format enables direct MLT rendering while maintaining Kdenlive-specific project data.

### Format Generations

- **Gen 1 (≤0.9.10)**: KDE 4.x era with data duplication issues.
- **Gen 2 (15.04–17.08)**: KF5/Qt5 migration.
- **Gen 3 (19.04.0–20.04.3)**: Timeline 2 engine.
- **Gen 4 (20.08.0–22.12.3)**: Fixed decimal separator conflicts; introduced in-track-transitions ("mixes") in 20.12.0.
- **Gen 5 (23.04.0+, v1.1)**: Multiple sequence support; each timeline embedded in MLT tractors.

### Project XML Structure

Root element contains: `<profile>` (frame rate, aspect ratio), `<producer>` (master/timeline clip definitions), `<playlist>` (tracks with entries), `<tractor>` (track compositions with transitions). A `main_bin` playlist holds project settings and all bin clips.

### Proxy-Related Properties

Stored on MLT producer elements:

- `kdenlive:proxy` — proxy clip URL, or "-" if no proxy should be used for that clip.
- `kdenlive:originalurl` — the clip's original URL, useful to retrieve the original when the clip was proxied.

> "Kdenlive stores **only references** to external media files via URLs, not embedded content (except for title clips and color clips)."

### Media References

All paths are stored as URLs. The avformat producer (FFmpeg-backed) handles all video/audio media. The documentation does not explicitly restrict media references to local filesystem paths — URL form is used throughout.

## Structural Metadata

- **Format**: MLT XML with kdenlive: namespace extensions
- **Extension**: `.kdenlive`
- **Current generation**: 5 (v1.1, 23.04+)
- **Proxy fields**: `kdenlive:proxy`, `kdenlive:originalurl`
