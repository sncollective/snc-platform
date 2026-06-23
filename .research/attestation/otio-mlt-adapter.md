---
source_handle: otio-mlt-adapter
fetched: 2026-06-23
source_url: https://github.com/apetrynet/otio-mlt-adapter
provenance: source-direct
---

## Summary

`otio-mlt-adapter` is a Python package that enables writing OTIO timelines to MLT-flavored XML files for use with `melt`. It is write-only (OTIO → MLT; cannot parse MLT XML back into OTIO).

## Key passages

**Purpose:** "The MLT XML adapter produces mlt flavored xml files used in conjunction with melt to preview or render timelines."

**Write-only:** The adapter explicitly "can only produce `.mlt` files, not parse them."

**Usage:**
```python
otio.adapters.write_to_file(timeline, 'converted_timeline.mlt')
# or with arguments:
otio.adapters.write_to_file(timeline, 'converted_timeline.mlt', colorspace=709)
```

**Supported features:** Multiple video/audio tracks, gaps, nesting, transitions, linear speed effects.

**Limitations:**
- Audio handling limited when clips share sources with video tracks
- Effects applied to tracks/stacks not implemented
- Markers and "fancy" speed effects unsupported

**Compatible OTIO versions:** 0.12.1, 0.13.0, 0.14.0 (last published versions). Latest release v0.3.0 was December 2, 2021. Not updated for OTIO 0.17+ plugin-architecture changes.

**Maintenance status:** Last release 2021. PyPI development status: Beta. The compatibility declaration does not include OTIO 0.18.0. The plugin may require updates to work with current OTIO.

**License:** MIT.

## Structural metadata

- Type: GitHub repository + PyPI package
- Scope: OTIO → MLT XML adapter
- Format: GitHub repository page
