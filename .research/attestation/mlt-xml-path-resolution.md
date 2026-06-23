---
source_handle: mlt-xml-path-resolution
fetched: 2026-06-23
source_url: https://github.com/mltframework/mlt/blob/master/src/modules/xml/producer_xml.c
provenance: source-direct
---

## Summary

The MLT XML producer (`producer_xml.c`) implements a root-relative path resolution system for media resources in MLT XML files.

## Key passages

**Root directory concept:**
`char *root = mlt_properties_get(context->producer_map, "root");`

The XML producer maintains a `root` directory. When an MLT XML file is loaded, the root is typically set to the directory containing the XML file.

**`qualify_property()` function — path resolution logic:**
1. **Absolute paths preserved** — paths starting with `/`, `\`, or a Windows drive letter (e.g., `C:`) are left unchanged.
2. **Protocol-prefixed resources preserved** — resources beginning with recognized prefixes like `file:`, `http:`, `ftp:`, etc. are left as-is. The function recognizes the `:` after a protocol scheme.
3. **Relative paths qualified** — if a path has none of the above indicators, the function prepends `root + "/" + resource`.

**Properties that undergo qualification:**
- `resource` (the primary media path)
- `luma` and compositing-related properties
- `argument` (for timewarp producers)

**Implication for proxy workflows:**
String substitution of the `resource` property in an MLT XML file is a well-supported pattern: absolute paths and HTTP URLs are preserved verbatim; relative paths resolve against the XML file's location. Proxy swap = replacing the `resource` property value. Since the property is immutable post-construction, a full XML rewrite (or re-generate) is needed to switch from proxy to original.

**Implication for HTTP URL media sources:**
HTTP URLs in `resource` properties (e.g., `http://platform-host/media/123/stream`) are recognized by the `://` protocol pattern and left unmodified during path qualification — they are passed directly to the avformat producer, which passes them to FFmpeg's `avformat_open_input()`.

## Structural metadata

- Type: source code
- Scope: MLT XML producer path resolution
- Format: GitHub source file
