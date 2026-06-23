---
source_handle: mlt-melt-cli
fetched: 2026-06-23
source_url: https://mltframework.org/docs/melt/
provenance: source-direct
---

## Summary

Official MLT Framework documentation for the `melt` command-line tool. Documents CLI syntax, producer/consumer model, rendering MLT XML files headlessly, and key rendering flags.

## Key Passages

### Basic Syntax

> `melt [options] [producer [name=value]]*`

### Rendering MLT XML Files

Melt can directly execute MLT XML project files as producers. Kdenlive's render dialog generates `.mlt` scripts that are then executed via:

> `$ melt your_script.mlt`

### File Output (Consumer)

To render to a file, a consumer is specified:

> `-consumer avformat:output.avi acodec=libmp3lame vcodec=libx264`

### Serialization / Project Exchange

> `-serialise file.melt` saves the current composition to an XML file, enabling reuse across MLT applications.

The XML consumer provides broader compatibility across MLT-based tools.

### Headless Server Operation

The FAQ confirms: "MLT is often used for SDI output, encoding, streaming, and rendering complex multitrack compositions." The melt tool operates without any GUI requirement, making it suitable for server-side batch rendering.

**Known limitation**: When rendering Kdenlive projects via melt on headless servers, Qt libraries require a display. The workaround is `xvfb` (X virtual framebuffer).

### Parser Order Dependency

> "Order is incredibly important" — the parser processes flags sequentially left to right.

## Structural Metadata

- **CLI tool**: `melt` (included with MLT framework)
- **Input**: MLT XML files, producer specifications, media files
- **Output**: Via `-consumer avformat:` with codec parameters
- **Headless**: Yes; Qt display workaround needed for Kdenlive-generated scripts
- **Kdenlive render workflow**: Kdenlive → Generate Script → `.mlt` file → `melt script.mlt`
