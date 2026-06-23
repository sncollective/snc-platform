---
source_handle: otio-repo-and-bindings
fetched: 2026-06-23
source_url: https://github.com/AcademySoftwareFoundation/OpenTimelineIO
provenance: source-direct
---

## Summary

OpenTimelineIO (OTIO) is an open-source project under Academy Software Foundation (ASWF) governance, licensed Apache 2.0. It is a C++ core library with mature Python bindings; JavaScript bindings exist as a separate community project and are not production-ready.

## Key passages

**License:** Apache 2.0 (per `LICENSE.txt` in repository).

**ASWF governance:** The project is hosted under the Academy Software Foundation GitHub organization, confirming formal ASWF governance.

**Language composition:** C++ (48.6%) and Python (48.5%) are the primary languages. The C++ core provides the data model; Python bindings are generated via SWIG and used by OpenShot's UI and other tools.

**Python binding maturity:** Described as "mature framework widely deployed across the film and television industries." The Python API is "considered stable, but is still undergoing active development."

**JavaScript/Node.js bindings:** A separate community project (`JeanChristopheMorinPerso/OpenTimelineIO-JS-Bindings`) exists. It is explicitly "a work in progress" with partial support for `SerializableObject`, `Clip`, `Marker`, `SerializableCollection`. Serialization is "mostly working, though it needs more work." `AnyVector` is unhandled; memory management has potential leaks. No adapter support (EDL, AAF, FCP XML, MLT) is documented for the JS bindings. Not production-ready.

**Current release:** v0.18.0 (November 6, 2025).

**Adapter architecture (from v0.17.0 onward):** The core `opentimelineio` PyPI package contains only three native adapters: `otio_json`, `otiod`, `otioz`. All additional format adapters (CMX 3600 EDL, AAF, FCP XML, ALE, etc.) require the separate `OpenTimelineIO-Plugins` package or individual adapter packages.

## Structural metadata

- Type: repository README + release notes
- Scope: OTIO project-level overview
- Format: GitHub repository page
