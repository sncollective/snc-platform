---
source_handle: otio-adapters
fetched: 2026-06-23
source_url: https://opentimelineio.readthedocs.io/en/latest/tutorials/adapters.html
provenance: source-direct
---

## Summary

OTIO's adapter coverage as of v0.18.0. Three formats are built into the core package; the remaining ~11 formats require the `OpenTimelineIO-Plugins` package or standalone adapter repos.

## Key passages

**Core package (built-in) adapters:**
- `otio_json` — OTIO's native JSON format
- `otiod` — directory bundle (`.otio` + local media)
- `otioz` — zip bundle (`.otio` + local media)

**Community-supported adapters (via `OpenTimelineIO-Plugins` package):**
- AAF
- ALE
- Burnins
- CMX 3600 (EDL)
- FCP XML
- Maya Sequencer
- SVG
- XGES (Pitivi/GNOME video editor format)

**Additional adapters (outside main packages):**
- Kdenlive
- FCPX XML
- HLS Playlist

**MLT adapter:** NOT in the above lists. A separate `otio-mlt-adapter` package exists on PyPI (see `otio-mlt-adapter` handle). It is write-only (OTIO → MLT XML; cannot read MLT XML back).

**Adapter format:** "adapters are implemented as plugins" and can be registered via environment variable or custom Python modules.

**Coverage note:** The documentation acknowledges adapters have "varying levels" of support — not all adapters are equally complete or maintained.

## Structural metadata

- Type: official documentation
- Scope: OTIO adapter system
- Format: ReadTheDocs page
