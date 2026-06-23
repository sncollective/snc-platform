---
source_handle: openshot-libopenshot-github
fetched: 2026-06-23
source_url: https://github.com/OpenShot/libopenshot
provenance: source-direct
---

## Summary

GitHub repository for libopenshot — the C++ video library underlying OpenShot Video Editor. Documents the library's capabilities, Python bindings structure, API surface, and licensing.

## Key Passages

### Project Description

> "OpenShot Video Library (libopenshot) is a free, open-source C++ library dedicated to delivering high quality video editing, animation, and playback solutions to the world."

### License

LGPL-3.0.

### Latest Release

Version 0.7.0 was released on April 8, 2026 (coinciding with openshot-qt v3.5.1).

### API Language Support

Bindings for C++, Python, and Ruby via SWIG. Python is the language used by the OpenShot GUI.

### Features Listed

Multi-layer compositing, video and audio effects, animation curves, audio mixing with resampling, VST & AU plugin support, frame rate conversions, "compatibility with all FFmpeg formats and codecs."

### Python Binding Classes (from openshot.i SWIG interface)

Confirmed exposed classes include:
- `Timeline` — the main composition container
- `FFmpegWriter` — video/audio encoder via FFmpeg
- `FFmpegReader` — media reader via FFmpeg
- `Clip` — timeline clip representation
- `Frame`, `ReaderBase`, `WriterBase`, `ChunkReader`, `ChunkWriter`

**No HTTP/URL reader class** is exposed in the bindings.
**No OTIO-related classes** are included.

### Headless Python Render

The libopenshot Python API (`openshot.Timeline` + `openshot.FFmpegWriter`) can be used from a Python script without the OpenShot GUI. No official documentation of this pattern exists in the README or INSTALL.md; however the class surface is exposed via SWIG bindings. The `FFmpegWriter` class is documented as using FFmpeg libraries "to write and encode video files and audio files."

### HTTP/URL Media Support

The bindings expose no dedicated HTTP reader. The `FFmpegReader` (wrapped via libavformat/FFmpeg) would inherit FFmpeg's protocol support including HTTP/HTTPS, but this is not documented or confirmed by the project.

### OTIO Support

Not documented. No OTIO classes appear in the SWIG bindings file. OpenShot 3.4 (December 2025) and 3.5.1 (April 2026) release notes make no mention of OTIO support.

## Structural Metadata

- **License**: LGPL-3.0 (library); openshot-qt is GPL-3.0
- **Latest version**: libopenshot 0.7.0 (April 8, 2026)
- **Language**: C++ with Python/Ruby SWIG bindings
- **Headless render**: Possible via Python API (Timeline + FFmpegWriter) but not officially documented
- **OTIO**: Not supported
- **HTTP media**: Not documented; theoretically inherits FFmpeg protocol layer
