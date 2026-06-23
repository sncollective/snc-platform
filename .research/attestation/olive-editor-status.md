---
source_handle: olive-editor-status
fetched: 2026-06-23
source_url: https://github.com/olive-editor/olive
provenance: source-direct
---

## Summary

Status assessment of Olive video editor based on GitHub repository data and release page. Documents the project's alpha status, release history, and known capability gaps.

## Key Passages

### Project Status

> "Olive is alpha software and is considered highly unstable."

This warning appears in the README. The repository shows 6,646 commits with active development, but no stable release exists beyond 0.1.x.

### Release History

- **0.2.0-nightly** (December 5, 2024): Unstable development build; last code change was September 24, 2023.
- **0.1.2** (dates unclear): Fixed render freezing, broken translations.
- **0.1.0**: Initial release build.
- **Legacy releases**: December 2018 and November 2018 stable builds.

The gap between last code change (September 2023) and the nightly label date (December 2024) suggests the 0.2 branch has been in extended stagnation.

### Architecture Notes (from search evidence)

Search evidence indicates a significant architectural rewrite in progress for 0.2.x: the node editor was rewritten from C++ to C#, and the rendering engine was reportedly being based on Godot. These are unconfirmed secondary claims from VideoHelp/filmora review sources, not from the GitHub README directly.

### OTIO Support

A GitHub issue #1701 titled "[PROJECT] OTIO Improvements" exists, indicating OTIO was on the development roadmap. The status of this issue is not confirmed from the available search evidence. Basic OTIO import was reportedly planned for the 0.2.x branch.

### Proxy Support

A GitHub issue #819 "Question: Proxy in Exported Video?" exists. From search evidence: proxy support was listed as an incomplete feature in the 0.2.x branch.

### Headless Render

From search evidence: "The development team has been looking into leveraging the render pipeline for network rendering, allowing for the possibility of multiple headless computers working together to render frames both for preview caching and for export." This is a roadmap item, not a shipped feature.

### Project File Format

Not documented in the README excerpt. Custom format (likely `.ove` or similar) based on Olive's custom timeline architecture.

## Structural Metadata

- **License**: GPL-3.0
- **Status**: Alpha (highly unstable); last substantive code change September 2023
- **Latest release**: 0.2.0-nightly (effectively a development snapshot)
- **OTIO**: Roadmap/issue (#1701); not shipped in any stable release
- **Proxy**: Incomplete feature in 0.2.x branch
- **Headless render**: Roadmap item; not shipped
- **Project format**: Not documented in primary sources reviewed
