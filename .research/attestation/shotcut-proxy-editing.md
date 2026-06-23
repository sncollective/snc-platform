---
source_handle: shotcut-proxy-editing
fetched: 2026-06-23
source_url: https://forum.shotcut.org/t/settings-proxy-editing/18517
provenance: source-direct
---

## Summary

Official Shotcut documentation of the proxy editing feature (Settings > Proxy Editing). Documents how proxy editing works, the hash-based matching system, storage locations, export behavior, and known limitations.

## Key Passages

### Core Definition

> "Proxy editing is the process of creating and using low resolution videos and images in places of the original or optimized (Convert to Edit-friendly) files."

### Export / Render Substitution

> "When exporting, proxies are automatically replaced with original or converted files, ensuring full-resolution output regardless of editing resolution."

This is the normal export path. An exception exists: when "Video > Use preview scaling" is checked in Advanced export mode, proxies are used — documented as "not recommended for final output."

### Proxy Matching System

Each original file receives a unique 32-character hash identifier used to locate its proxy. This handles file relocation, corruption recovery, and version changes better than filename matching alone.

### Proxy Generation Rules

Proxies are auto-generated only when:
- File is video (with optional audio) or image.
- Not an image sequence or alpha-channel clip.
- Not cover art metadata.
- Image dimensions exceed 1.3× the preview scaling resolution (minimum 540p if scaling is off).
- No existing proxy or proxy not disabled.

### Storage Locations

- **Global folder**: Default "proxies" subfolder in App Data Directory (customizable via Settings).
- **Project folder**: "proxies" subfolder within project directories.

### Proxy File Formats

MP4 for video, JPEG for images — chosen for "low resolution, small file size, fast to generate, fast to seek and decode, and decent image quality."

### Known Issues (load-bearing for platform integration)

1. Proxies can mask source media problems (e.g., seeking errors).
2. No automatic proxy generation for clip-only projects without Timeline/Playlist.
3. **`File > Export Frame` exports upscaled proxy rather than original** — a documented limitation.
4. **MLT XML files opened as clips do not use proxy replacement** — important for nested-sequence workflows.

## Structural Metadata

- **Proxy format**: MP4 (video), JPEG (images)
- **Matching**: 32-character hash per original file
- **Render substitution**: Automatic on standard export; opt-out by checking "Use preview scaling"
- **MLT XML clips**: No proxy substitution (known limitation)
