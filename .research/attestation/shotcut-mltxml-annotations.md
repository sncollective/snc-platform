---
source_handle: shotcut-mltxml-annotations
fetched: 2026-06-23
source_url: https://www.shotcut.org/notes/mltxml-annotations/
provenance: source-direct
---

## Summary

Official Shotcut documentation describing the custom properties Shotcut adds to MLT XML beyond the MLT standard. Documents the project format requirements, proxy-related fields, and what Shotcut-specific data must be present for the project to open correctly.

## Key Passages

### Custom Properties Overview

Shotcut extends MLT XML with properties across several object types. The documentation states:

> "Shotcut adds several XML elements and attributes to the MLT XML it generates, and currently it needs many of these to properly map MLT objects into the Shotcut UI."

### Proxy Handling Properties (on Producer elements)

- `shotcut:resource` — copy of the original resource path (before proxy substitution).
- `shotcut:disableProxy` — flag to prevent proxy use for a specific clip.
- `shotcut:proxy.meta` — indicator of whether metadata reflects proxy or source media.

### Project Format Requirements

Two required structural elements:
1. A playlist element with id `main bin` for the Playlist panel.
2. A playlist with id `background` containing a black producer as the first track of the master tractor.

### Track Properties

- Track names stored via playlist elements.
- Audio/video designations via custom properties.

### Tractor-Level Properties

Include identification markers, virtual clip flags, timeline zoom levels, track heights, and marker storage.

### Filter/Transition Properties

Provide Shotcut UI identifiers to disambiguate between multiple Shotcut interface representations of single MLT filters or transitions.

### Producer Properties

Extensive metadata including: user comments, display aspect ratios, image sequence flags, friendly captions, file hashes, clip grouping.

## What Is Not Documented Here

- Headless rendering compatibility.
- OpenTimelineIO (OTIO) support.
- HTTP/URL media source support.

## Structural Metadata

- **Format**: MLT XML with `shotcut:` namespace extensions
- **Extension**: `.mlt`
- **Proxy fields**: `shotcut:resource`, `shotcut:disableProxy`, `shotcut:proxy.meta`
- **CLI render**: Not documented on this page; `melt` usage confirmed via the MLT layer
