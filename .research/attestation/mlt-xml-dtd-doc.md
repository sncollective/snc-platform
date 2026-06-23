---
source_handle: mlt-xml-dtd-doc
fetched: 2026-06-23
source_url: https://www.mltframework.org/docs/mltxml/
provenance: source-direct
---

## Summary

The MLT XML format documentation describes the serialization format for MLT projects. The `resource` property in producer elements identifies the media source. A MLT XML doc can itself be a resource (enabling nesting).

## Key passages

**Resource property in producer elements:**
```xml
<property name="resource">clip1.dv</property>
```

The documentation shows only local file path examples (`clip1.dv`, `clip2.mpeg`). HTTP URLs are not explicitly enumerated, but the avformat producer's own documentation (see `mlt-avformat-producer`) confirms the `resource` property accepts the full URL form `[{protocol}|{format}]:{resource}[?...]`.

**Nested XML:**
> "a MLT XML doc can be specified as a resource, so XML docs can naturally encapsulate other XML docs"

This enables a modular XML composition approach.

**Path resolution context:**
The XML producer (`producer_xml.c`) resolves relative resource paths against the XML file's location. Absolute paths and protocol-prefixed URLs are passed through verbatim (see `mlt-xml-path-resolution`).

## Structural metadata

- Type: official documentation
- Scope: MLT XML format specification
- Format: MLT framework documentation site
