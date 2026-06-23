---
source_handle: mlt-melt-docs
fetched: 2026-06-23
source_url: https://www.mltframework.org/docs/melt/
provenance: source-direct
---

## Summary

The `melt` binary is the MLT framework's command-line tool, described in its own documentation as "a powerful, if somewhat obscure, multitrack command line oriented video editor" that was originally developed as a test tool for the MLT framework. It functions as a headless renderer: given a media specification on the command line (or an MLT XML file as input), it processes the pipeline and writes output via a consumer specification — no GUI is required.

## Key passages

**Headless rendering mechanism:**
- melt produces output by piping MLT frames through a consumer: `-consumer avformat:output.avi` writes to a file.
- `-serialise [filename]` saves the command structure as an MLT XML document for later replay.
- The xml consumer creates an MLT XML document: `-consumer xml:basic.mlt`.

**Media reference input:**
- The simplest invocation is `melt file` where `file` is a local path.
- The avformat producer can be forced explicitly: `melt avformat:file.mpeg`.
- No explicit documentation of HTTP URL inputs appears on this page; protocol support is delegated to the underlying avformat/FFmpeg layer (see `mlt-avformat-producer`).

**Headless/X11 note (from mailing list, same source family):**
- melt's core transcode pipeline runs headless; the title/text producer (frei0r-based) may require an X display. Workaround: `xvfb-run -a melt (...)`. Pure A/V transcode without title overlays does not need X.

## Structural metadata

- Type: tool documentation
- Scope: melt CLI reference
- Format: web documentation page
