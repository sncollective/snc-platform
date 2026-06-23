---
source_handle: kdenlive-docs-25-04
fetched: 2026-06-23
source_url: https://kdenlive.org/news/releases/25.04.0/
provenance: source-direct
---

## Summary

Official release notes for Kdenlive 25.04.0 (KDE Gear 25.04, released April 2025). The release is notable for two platform-relevant features: native C++ OpenTimelineIO support and proxy clip improvements for alpha-channel media.

## Key Passages

### OTIO Support (OpenTimelineIO)

The release notes describe a complete rewrite of OTIO import/export:

> "Darby Johnston rewrote the OpenTimelineIO import and export functions using the C++ library."

The notes emphasize this was funded through community fundraising specifically for this feature, representing an upgrade from a prior Python-based implementation. The capability enables project exchange with other editing applications. An explicit limitation is stated:

> "Effects, filters, and transitions are not exported as each application uses its own standard."

OTIO support in Kdenlive first appeared in version 23.08; 25.04 upgrades the implementation to C++ and improves compatibility and bug fixes.

The companion `kdenlive-opentimelineio` GitHub repository (KDE/kdenlive-opentimelineio) was deprecated upon this release, with a note that "Kdenlive has native support for OpenTimelineIO since version 25.04" and that the native integration "offers more features and works much more reliable than the adapter does."

### Proxy Workflow Improvements

- Fixed proxy clips workflow for videos with an alpha channel; enforces libvpx decoders when transcoding files with alpha content.
- Proxy profiles for clips with transparency are now configurable globally rather than per-project.
- Proxy clips now have fixed frame rates using vsync setting.
- Improved alpha detection for playlist clips to disable automatic proxies.

### Other Notable Features (non-proxy, non-OTIO)

- Object segmentation using SAM2 model for background removal (local processing).
- GPU-accelerated filters on Intel and AMD cards.
- Keyframe interface overhaul.
- Multiple adjacent clips duration adjustable in single operation.
- Improved AV1 support.

## Structural Metadata

- **Product version**: 25.04.0
- **OTIO introduced**: 23.08; rewritten in C++ in 25.04
- **License**: GPL-2.0+ (Kdenlive standard)
- **Project file format**: MLT XML (.kdenlive extension)
