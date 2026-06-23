---
title: "Acquisition manifest — video-production-media-hub"
campaign: video-production-media-hub
updated: 2026-06-23
---

# Acquisition manifest

Consolidated from the four specialists' returns. Verification-independent offgas — these are
gaps regardless of the synthesis verdict. Promotion into `.work/` (the standing
`research-acquisition-queue` item) is operator-confirmed, never automatic.

## Blocking — both discharged 2026-06-23

Both originally-blocking sources were obtained post-engagement from authoritative mirrors:

- **Resolve Scripting README** — verbatim community mirror (corroborated by a second mirror),
  attested `resolve-scripting-readme`. Resolved: scripting requires Resolve running, but `-nogui`
  headless mode works with the scripting APIs (incl. render methods `AddRenderJob`/`StartRendering`);
  remote invocation is a Preferences setting; the Free/Studio boundary is per-function (common
  superset). **Overturned** the held "no headless render."
- **Resolve Reference Manual (interchange chapters)** — Resolve 18.6 Reference Manual, HTML-mirrored
  at steakunderwater VFXPedia, attested `resolve-manual-interchange`. Resolved the interchange set:
  import AAF/EDL/XML/DRT/ADL/OTIO; export OTIO/AAF/XML/EDL/CDL/ALE/edit-index; **OTIO native** (no
  adapter); markers export to EDL. Residual (minor): AAF marker round-trip *fidelity* detail not
  extracted from the mirror.

_No fully-blocking sources remain outstanding._

## Enriching (would deepen a facet beyond the web layer)

| Source | Class | Web-availability | Completes |
|---|---|---|---|
| **Garage S3 Range-request support** (`garagehq.deuxfleurs.fr` S3-compatibility reference) | primary-doc | Public, not yet fetched | **The load-bearing one** — resolves the facet-1/facet-3 tension: whether presigned GET URLs honor Range, making the HTTP-redirect path seekable for `melt` render |
| **`otio-mlt-adapter` current compatibility** (repo issue tracker / recent commits) | primary-doc | Public | Whether the OTIO → MLT write path is usable against OTIO 0.18 or needs a fork |
| **MLT FAQ on HTTP/stream inputs** (`mltframework.org/faq/`) | primary-doc | Anubis-blocked on fetch; needs mirror/curl | Canonical MLT-level statement on HTTP streaming input + the seek limitation |
| **Shotcut HTTP-URL media test** (Shotcut forum/docs for `http://` clip import) | portal | Moderate | Confirms/denies whether Shotcut's UI accepts HTTP URLs as clip sources |
| **Blender 4.5 LTS release notes** (`developer.blender.org/docs/release_notes/4.5/`) | primary-doc | URL exists; returned 403 to the fetcher | Blender 4.5 VSE section — native OTIO status, any new VSE media features |
| **libopenshot Python headless-render example** (`github.com/OpenShot/libopenshot` examples/tests) | primary-doc | Public | Grounds the "headless render theoretically possible" claim with a working pattern |
| **rclone VFS full-mode performance** (`rclone.org/vfs_cache/`) | primary-doc | Public | Latency/throughput posture for large media over an S3-compatible backend — viability of rclone-as-mount vs direct NFS |
| **Clapshot `organizer.proto`** (`github.com/elonen/clapshot` protobuf) | primary-doc | Public (GitHub raw) | What a custom approval-Organizer plugin could expose in the data model |
| **Frame.io V4 API reference** (`developer.adobe.com/frameio/api/current/`) | primary-doc | Enterprise/account-gated | The comment + approval-state data model at the API level |
