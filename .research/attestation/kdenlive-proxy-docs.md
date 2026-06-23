---
source_handle: kdenlive-proxy-docs
fetched: 2026-06-23
source_url: https://docs.kdenlive.org/en/project_and_asset_management/project_settings/proxy_settings.html
provenance: source-direct
---

## Summary

Official Kdenlive documentation page for proxy clip settings. Covers automatic proxy generation, render substitution behavior, configuration options, external proxies, and performance testing.

## Key Passages

### Core Proxy Behavior

> "When the Proxy clips is enabled, Kdenlive will automatically create reduced versions of your source clips and use these versions for editing."

### Render Substitution

> "The proxy clips will be replaced with the originals for the full resolution when rendering."

This is the automatic substitution on final render. The render dialog includes a "Use Proxy Clips" checkbox that, when checked, keeps proxies in the render output — documented as "useful for quick renderings to check or verify things."

### Proxy Configuration

- Automatic generation for video clips exceeding a specified pixel width (default: 640px frame width).
- Selectable encoding profiles defining "size, codecs and bitrate."
- Manual per-clip control via right-click in project bin.
- Image proxies: similar automatic generation for images above threshold dimensions.
- External proxy clips: supported when "External proxy clips" option is enabled (reads camera-generated proxy files).

### Headless Render Behavior with Proxies

From the companion search evidence (kdenlive.org proxy article, not this page directly):

The `kdenlive:proxy` property stores the proxy URL; `kdenlive:originalurl` stores the original. MLT has no native concept of proxy clips — when Kdenlive exports a render script (`.mlt`) for headless execution via `melt`, it rewrites the resource property to point to the original file. This means `melt your_script.mlt` uses originals by default unless the "Use Proxy Clips" box was checked during script generation.

**Known caveat**: Melt requires Qt libraries; on headless systems with no Desktop Environment, `xvfb` (X virtual framebuffer) is needed as a wrapper.

## Structural Metadata

- **Proxy generation format**: Configurable profiles (typically H.264/WebP at reduced resolution)
- **Storage**: Configurable; default `kdenlive/proxies/` in app data directory
- **Headless render**: Via `melt <script>.mlt`; requires xvfb on headless servers
