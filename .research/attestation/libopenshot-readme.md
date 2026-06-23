---
source_handle: libopenshot-readme
fetched: 2026-06-23
source_url: https://github.com/OpenShot/libopenshot/blob/develop/README.md
provenance: source-direct
---

## Summary

libopenshot is OpenShot's C++ video editing library with Python (and Ruby) bindings via SWIG. It supports all FFmpeg formats. Its headless render capability is programmatic (via Python API) rather than via a dedicated CLI tool.

## Key passages

**Language bindings:** "API currently supports C++, Python, and Ruby." The Python binding is described as comprehensive ("All Features Supported").

**FFmpeg dependency:** "All FFmpeg Formats and Codecs Supported (Images, Videos, and Audio files)" — libopenshot uses FFmpeg internally, inheriting its format/codec coverage.

**License:** GNU LGPL-3.0. (Commercial licensing available from OpenShot.)

**Qt dependency:** The README references a "Qt Video Player Included" component. However, the library itself is usable without the Qt player — the GUI component is optional. OpenShot's Qt UI (openshot-qt) is a separate Python application that uses libopenshot; the library's core C++ render engine does not require Qt at render time.

**Headless render capability:** No dedicated CLI tool documented. Headless rendering is done via the Python API: load clips, configure timeline, call the render method. The library is the engine; the caller drives it programmatically.

**Media reference handling:** Not explicitly documented in the README as to whether HTTP URLs are accepted. The FFmpeg backend suggests HTTP URL support is inherited, but no authoritative statement was found.

**Binding generation:** Python bindings are created via SWIG. The `openshot-qt` UI uses the Python binding as its render backend.

## Structural metadata

- Type: GitHub README
- Scope: libopenshot library overview
- Format: GitHub repository
