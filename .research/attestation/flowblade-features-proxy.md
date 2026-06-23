---
source_handle: flowblade-features-proxy
fetched: 2026-06-23
source_url: https://jliljebl.github.io/flowblade/webhelp/proxy.html
provenance: source-direct
---

## Summary

Official Flowblade proxy editing documentation. Documents the five-phase proxy workflow, path-switching mechanism, constraints, and batch render queue relationship.

## Key Passages

### How Proxies Work

> "Proxy editing is a method of editing in which original media clips are presented on timeline by proxy clips, which is needed when original media makes too high demands for either disk bandwidth or CPU processing power to enable responsive editing."

### Five-Phase Workflow

> "(1) Render proxy media from original media (2) Replace original media with proxy media (3) Edit using proxy media (4) Replace proxy media with original media (5) Render final program using original media."

### Path Substitution Implementation

> "Flowblade uses a programming technique that changes the paths used by media items and clips to point either to hidden proxy media or original media."

Implementation: "Changing from one to another is implemented by writing a hidden temporary project file to disk and replacing paths when project is read back."

### Constraint: All-or-Nothing

> "It is only possible to use all existing proxy media and clips or all original media" — no selective per-clip proxy use.

### Constraint: Deletion Breaks Conversion

> "Deleting media during proxy editing breaks conversion back to original files."

### GPU Proxy Generation (from release notes evidence)

Version 2.12+: "Proxies can now be rendered using FFMPEG CLI app if system supports GPU encoding, with 4-10x speed improvements with this approach."

### Batch Render Queue

From features page:
> "Flowblade offers a dedicated Batch Render Queue application" that operates as a separate process.

This is a GUI batch queue application, not a headless/CLI render path.

## From GitHub Issue #746 (project file format discussion)

Flowblade's native format is `.flb` — a Python pickle of project objects (binary format). This is not human-readable and not MLT XML. The project has discussed but not implemented a transition to a text-based format.

Flowblade can **export** to MLT XML for interop, and uses MLT XML internally for container clips. But the primary save format is the binary `.flb` pickle.

## Structural Metadata

- **License**: GPL-3.0
- **Latest version**: 2.24.2 (May 29, 2026)
- **Native project format**: `.flb` (Python pickle, binary — NOT MLT XML)
- **MLT XML**: Available as export/interop format, used internally for clips
- **Proxy**: Native, all-or-nothing, path-substitution via temp project file write
- **Headless/CLI render**: Not documented; batch queue is GUI-based separate process
- **OTIO**: Not documented in any source reviewed
- **HTTP media**: Not documented
