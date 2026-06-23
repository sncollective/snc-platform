---
source_handle: shotcut-proxy-mlt-xml
fetched: 2026-06-23
source_url: https://www.shotcut.org/notes/mltxml-annotations/
provenance: source-direct
---

## Summary

Shotcut's MLT XML annotations document how Shotcut manages proxy clips within MLT XML. The proxy mechanism relies on custom `shotcut:*` properties on producer/chain elements, preserving the original resource reference while swapping the active `resource` property for the proxy file.

## Key passages

**Properties used for proxy management:**

- `shotcut:resource` — "A copy of the resource property used by the proxy manager." Preserves the source file reference even while the active `resource` is pointing at the proxy.
- `shotcut:disableProxy` — set to `1` to disable proxy generation for a producer.
- `shotcut:proxy.meta` — indicates whether `meta.*` properties reflect the proxy (`1`) or the source media.
- `shotcut:originalResource` — copy of the resource property used by the "Reverse" action to restore the original media path.
- `shotcut:originalIn` / `shotcut:originalOut` — preserve timing information for reversal.

**Chain vs producer:**
> "As of version 21.05.01, Shotcut uses `chain` elements instead of `producer` elements when the service is avformat."

**Proxy workflow mechanics:**
- The active `resource` property is set to the proxy file path during editing.
- The original file path is preserved in `shotcut:resource` (or `shotcut:originalResource`).
- For final render, the proxy manager replaces the `resource` value with the original.
- This is effectively string substitution of a single XML property value — no structural XML changes are needed.

**Implication for platform proxy workflow:**
The same pattern applies to any platform-generated MLT XML: store both the proxy path and the original (or full-res) path, then rewrite the `resource` property before dispatching to `melt` for final render. Since `resource` is immutable post-construction (per MLT's producer lifecycle), the workflow is: generate an MLT XML file with the original resource path → hand to `melt` for render.

## Structural metadata

- Type: official Shotcut documentation
- Scope: MLT XML proxy properties
- Format: Shotcut documentation site
