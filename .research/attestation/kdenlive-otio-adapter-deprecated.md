---
source_handle: kdenlive-otio-adapter-deprecated
fetched: 2026-06-23
source_url: https://github.com/KDE/kdenlive-opentimelineio
provenance: source-direct
---

## Summary

The deprecated KDE/kdenlive-opentimelineio GitHub repository. This was the OTIO Python adapter for Kdenlive prior to native C++ support in Kdenlive 25.04.

## Key Passages

### Repository Status

> "DEPRECATED — deprecated and not maintained anymore."

### Reason for Deprecation

> "Kdenlive has native support for OpenTimelineIO since version 25.04."

> "Native integration offers more features and works much more reliable than the adapter does."

### Prior Functionality

The adapter provided `otioconvert` command-line tool integration for converting Kdenlive `.kdenlive` files to/from OTIO format.

### MIT License

The adapter was MIT licensed (separate from Kdenlive's GPL).

## Structural Significance

This repository confirms the timeline of OTIO support in Kdenlive:
- Pre-23.08: No OTIO support; this adapter was the only path.
- 23.08: Initial OTIO support added (Python-based).
- 25.04: Native C++ OTIO rewrite; this adapter deprecated.

The deprecation notice thus independently verifies the 25.04 OTIO claim in `kdenlive-docs-25-04`.

## Structural Metadata

- **Status**: Deprecated
- **Superseded by**: Kdenlive 25.04 native OTIO
- **License**: MIT
- **Tool**: `otioconvert` integration
