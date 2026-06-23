---
title: "Video-Production Media Hub — Editor Selection, Integration Path, and the Conditional Review Bridge"
campaign: video-production-media-hub
provenance: agent-synthesis
updated: 2026-06-23
output_kind: [selection-recommendation, synthesis-brief]
specialist_facets:
  - oss-editor-integration
  - resolve-and-proprietary
  - infra-and-render-backends
  - review-collab-bridge
---

# Video-Production Media Hub — Selection, Integration Path, Review Bridge

The decision this synthesis grounds: which open-source video editor(s) the platform integrates
with for video production (the near-term driver being album-release video), how media moves
between platform storage and those editors, and whether a review/approval surface is worth
building as an interim bridge. The evaluation axis is integration-fit with the available
infrastructure — a Proxmox host + a broadly-available storage array, of which the web platform +
auth is one access layer, not a hard boundary.

## Headline

1. **Primary editor targets: Kdenlive + Shotcut**, because they share one MLT XML project format
   that a single headless `melt` render service renders for both [mlt-melt-cli]{1}. Kdenlive adds
   native OTIO interchange (C++, since 25.04) [kdenlive-docs-25-04]{1}; Shotcut adds robust
   hash-matched proxy [shotcut-proxy-editing]{1}.
2. **The robust media path is a mounted storage array, not platform HTTP URLs.** Desktop editors
   read media cleanly from an NFS/SMB mount (or rclone FUSE with `--vfs-cache-mode full`)
   [rclone-mount-vfs]{1}; the platform's HTTP redirect-endpoint pattern has a seek limitation on
   streamed sources [mlt-avformat-producer]{1} that makes it the weaker path for editing media.
   This vindicates treating the infrastructure — not the web platform — as the integration
   substrate.
3. **Project-file generation needs no Python/OTIO sidecar for the MLT case** — MLT XML is
   plain-text XML [mlt-xml-dtd-doc]{1} and EDL is a plain-text format, both generable directly in
   Node.js; OTIO's AAF / FCP-XML adapters are Python-only [otio-adapters]{1}, so OTIO becomes
   relevant only if inbound FCP XML / AAF import is later required.
4. **The review bridge (D) is genuinely deferrable** — its components are platform-layer and
   independent of the editor-integration path; whether to build it turns on one open question
   (is version identity already in B's scope) and on whether the team needs to review
   work-in-progress cuts during B's development.

## 1. Editor selection (Q1 → recommendation)

| Editor | Role | Why |
|---|---|---|
| **Kdenlive** | **Primary** | MLT XML → `melt` headless render [mlt-melt-cli]{1}; native C++ OTIO since 25.04 [kdenlive-docs-25-04]{1}; native proxy with auto-substitution on render [kdenlive-proxy-docs]{1}. |
| **Shotcut** | **Primary** | MLT XML → same `melt` render substrate; hash-matched proxy with auto-substitution on export [shotcut-proxy-editing]{1}. No OTIO. |
| **OpenShot** | **Secondary** | Active and credible, but architecturally distinct — JSON `.osp`, `libopenshot` render engine, **no `melt` path**; headless render is undocumented (Python `Timeline`+`FFmpegWriter` exist but unsupported) [openshot-libopenshot-github]{1}; proxy only since 3.5.1 [openshot-qt-releases]{1}; no OTIO. Supportable as a project users bring, on a separate integration track. |
| **Blender VSE** | **Niche** | Robust native headless render (`blender -b`) [blender-cli-render]{1}, but binary `.blend` → platform-side project generation requires running Blender, not a file write. Fits motion-graphics / VFX, not general NLE. |
| **DaVinci Resolve** | **Supported, access-only** | If a team member uses it. Storage-access + interchange only (see §3). |
| **Olive** | **Exclude** | Effectively stagnant — last code change September 2023; headless render / OTIO / proxy are unshipped roadmap items; README warns "highly unstable" [olive-editor-status]{1}. |
| **Flowblade** | **Exclude (for automation)** | MLT *engine* but `.flb` Python-pickle save format, opaque to server-side manipulation, and no headless CLI render [flowblade-features-proxy]{1}. Usable by a human; not platform-automatable. |

**On OpenShot specifically** — the editor whose omission from the prior brief prompted this
engagement: it is a real, active editor, but it does **not** share the MLT render backend that
makes Kdenlive+Shotcut a single integration. Treating it as a co-primary would mean a second,
separate render path built on an undocumented library API. It belongs as a secondary target, not
a co-primary.

## 2. Integration path (Q2 → the architecture-open finding)

**Media access — mounted storage is robust for *seeking*, but not a free win.** A desktop editor
doing timeline scrubbing needs full random-access to source media. An NFS/SMB mount from the
storage array, or an rclone FUSE mount of Garage with `--vfs-cache-mode full`, presents
platform-stored media as a local filesystem path to every editor uniformly — MLT editors,
OpenShot, Blender, and Resolve alike [rclone-mount-vfs]{1}. Garage has no native rclone provider
entry but works with `provider = Other` + `force_path_style = true` [rclone-garage-config]{1}.

**The counterweight — network-perimeter cost (operator-surfaced).** A direct mount is robust on
the *seeking* axis, but it puts edit workstations on a path to the storage array that **bypasses
the platform's reverse-proxy/auth boundary (Caddy)** — a managed network exposure ("punching a
hole"), not a free win. So this is an architecture *to explore*, not a default: weigh the
direct-mount path against keeping media access **through** the platform's HTTP layer (which hinges
on the Garage Range-request question below), plus hybrids (VPN, a segmented VLAN, a scoped
export). The robustness advantage sits on the seeking axis; the network-perimeter cost is the
counterweight, and the Garage Range answer is what tips it.

**The HTTP redirect-endpoint path is the weaker, conditional one.** `melt` (via FFmpeg) follows
the platform's `/media/{id}/stream → 302 → presigned S3` redirect transparently
[ffmpeg-http-redirect]{1}, so it works for *headless render*. But MLT's avformat producer cannot
seek on HTTP *streams* — in-points and speed changes are ignored [mlt-avformat-producer]{1} — so
it is unreliable as *editing* source media. Whether full-file HTTP seeking works depends on the
presigned URL honoring Range requests; this is the load-bearing open question (see
`acquisitions.md`: Garage Range-request support).

**Render backend — `melt` on the Proxmox host.** For Kdenlive/Shotcut a single `melt` service
renders the MLT XML headlessly [mlt-melt-cli]{1}. Title/text producers need X11; on a
display-less host, `xvfb-run -a melt …` is the documented workaround (or composite titles via
FFmpeg `drawtext` in a separate pass) [mlt-melt-headless-xvfb]{1}. The service runs **on the
host with a direct storage-array mount** — not necessarily coupled to the web platform.

**Project-file generation — direct, no sidecar.** MLT XML and EDL (CMX 3600) are generable
directly in Node.js; OTIO's built-in adapters are JSON-only, with EDL/AAF/FCP-XML behind a
separate Python plugin package and the MLT adapter being write-only and last released 2021
against OTIO 0.12–0.14 (unconfirmed against current 0.18) [otio-adapters]{1}, [otio-mlt-adapter]{1}.
OTIO's JS bindings are not production-ready [otio-repo-and-bindings]{1}. So: generate MLT XML +
EDL directly; reach for an OTIO Python sidecar only if the platform later needs to *ingest* FCP
XML / AAF timelines.

**Re-validated build ladder:** Level 1 media hub (mounted storage + tus upload + FFmpeg
transcode) → Level 2 project-file generation (MLT XML + EDL, direct in Node.js) → Level 3 proxy
workflow (FFmpeg 720p + path substitution in the MLT XML `resource` property) → Level 4 cloud
render (`melt` service on the host; Pasolino is an early-stage reference implementation for
remote-`melt` [pasolino-remote-renderer]{1}). Levels
1–2 are the value core; Level 4 is the ambitious end.

## 3. DaVinci Resolve (proprietary, access-only)

If a team member edits in Resolve, support it as a storage+interchange consumer, not an automated
pipeline:

- **Scripting is Studio-only** ($295 one-time) [bmd-resolve-studio-product-page]{1}; Free has no
  scripting/automation.
- **No HTTP media** — Resolve's storage model is filesystem (NAS/SAN) [bmd-resolve-collaborate-page]{1};
  the mounted storage-array path (NFS/SMB, or rclone VFS-full) is the access route — the same path
  the OSS editors use.
- **Headless render via scripting is documented** (corrected post-engagement once the scripting
  README was obtained): Resolve runs headless via `-nogui` with the scripting APIs — including
  `AddRenderJob` / `StartRendering` — still working [resolve-scripting-readme]{1}. "Running" is
  still required, i.e. a *managed* headless Resolve process, not a stateless CLI like `melt`
  [resolve-scripting-readme]{2}. Scripting is a common superset for Free+Studio with Studio-gated
  functions returning False in Free [resolve-scripting-readme]{3} (single-mirror; full
  scripting/automation is framed as Studio, so assume Studio in practice).
- **Interchange confirmed** (from the Resolve 18.6 Reference Manual): Resolve imports
  AAF/EDL/XML/DRT/ADL/**OTIO** and exports OTIO/AAF/XML/EDL (+ CDL/ALE/edit-index)
  [resolve-manual-interchange]{1} — **OTIO is native**, no third-party adapter needed; markers
  export to EDL. Only the AAF marker round-trip *fidelity* detail is still partial. The platform
  still never calls Resolve in its core pipeline (FFmpeg handles server-side render); the
  headless-Resolve path matters only if a team member's Studio workflow warrants platform-managed
  Resolve rendering.

## 4. The review bridge (Q3 → conditional, deferrable)

**Minimum review surface** = three additive, independent schema concerns: timecoded comments (a
comment table with a `timestamp_seconds` anchor + player seek), an approval-state field on the
asset version (draft → in-review → approved, with needs-work as the return path), and version
identity (each revised upload is a new version, comments scoped to it). Frame.io's model
[frameio-review-model]{1} is the reference; it architecturally separates the annotation surface
from approval-state tracking, so the two build independently.

**Clapshot** (GPLv2, active — last release 2026-06-04) is the OSS video-review reference: it
already provides timecoded comments, drawing annotations, and real-time co-viewing
[clapshot-readme]{1}, but **not** approval states or version compare out of the box — those need
a custom Organizer plugin [clapshot-features]{1}. As an independent Rust+SQLite service with its
own auth/storage model, embedding it brings its own auth-bridging and storage-bridging work; a
native platform feature (comment table + state field + version id) is the more platform-native
path and generalizes beyond the album (reviewing any uploaded content, or viewer clips from the sibling clipping engagement).

**Sequencing (the build-vs-race-to-B call):** D's components have no dependency on the editor
path. The decision hinges on one open question — **is version identity already in scope for B?**
If yes, D's remaining work (comment table + state field) is comparatively small. And on team
process: if the team must review work-in-progress cuts *during* B's development, a review surface
is needed regardless of B's completion. (No effort figures are asserted here — these are flagged
for human estimation.)

**Real-time timeline co-editing stays deferred** — no production-grade CRDT/OT for video
timelines exists; the production leader (Resolve) uses lock-and-merge, and the CRDT ecosystem
targets text/structured docs, not timeline sequences [davinci-collab-arch]{1}, [crdt-production-landscape]{1}.

## Contradictions

**HTTP-redirect media viability — `oss-editor-integration` vs `infra-and-render-backends`
(relationship: qualifies).** Facet 1 holds the platform's streaming-redirect media URLs unusable
as editing source media (MLT can't seek on HTTP streams) [mlt-avformat-producer]{1}. Facet 3
holds that FFmpeg follows the 302 transparently [ffmpeg-http-redirect]{1} and the seek limit
applies only to non-Range streams — presigned S3/Garage GET supports Range, so full-file seeking
is likely available, pending confirmation. These are not incompatible: facet 3 qualifies facet 1
with the Range condition. They converge on mounted-storage as the robust editing path; the
disagreement is confined to whether the HTTP path is *also* viable for render. Resolution is
empirical — confirm Garage Range-request behavior (`acquisitions.md`). Not smoothed: the
recommendation rests on mounted storage, with the HTTP path held as conditional.

**Minor tensions carried in specialist briefs (not load-bearing here):** Flowblade "MLT-based" vs
`.flb` save format (qualifies — MLT engine, non-MLT format); `otio-mlt-adapter` currency
(stale 2021 release vs OTIO 0.18); Resolve collaboration-page broad API language vs Studio-page
explicit Studio-only framing (tension, same facts at different granularity).

## Disconfirming analysis

- **Against Kdenlive+Shotcut as primary:** the `xvfb` dependency for headless `melt` titles is
  real operational overhead [mlt-melt-headless-xvfb]{1}; OTIO does not transfer effects/filters
  [kdenlive-docs-25-04]{1}, so OTIO round-trip is cut-exchange only, not full project portability.
- **Against the mounted-storage recommendation:** rclone `--vfs-cache-mode full` needs local disk
  proportional to the working set and warms up on first access [rclone-mount-vfs]{1}; a direct
  NFS/SMB export from the array avoids the FUSE layer and is lower-latency where the LAN allows it.
- **What the prior brief got wrong:** it treated the HTTP redirect-endpoint as the clean editing
  media path (the seek limitation refutes that for editing use), and it omitted OpenShot entirely
  (a real editor, though secondary). Both are corrected here.

## Recommendation (consolidated, sequenced)

One ordered plan. The calendar is anchored to the **album-video production schedule**, whose
concrete dates are an operator input (not asserted here — see open questions); the sequencing
below is the relative frame.

**Editor:** adopt **Kdenlive + Shotcut** as the primary integration targets (one `melt` render
path serves both); support **DaVinci Resolve** as a storage + interchange consumer for any team
member already editing in it; treat **OpenShot** as a secondary, separately-integrated target
only if a team member needs it; keep **Blender VSE** for motion-graphics work; do not build
against Olive or Flowblade.

**Media path (explore — do not pre-commit to bypassing the platform):** settle the media-access
architecture first, *not* by defaulting to a storage-array mount. Weigh (a) keeping access
**through** the platform's HTTP layer behind Caddy — viable for render if Garage honors Range
(verify first); (b) a direct NFS/SMB/rclone mount — robust for editing-scrub but exposes storage
outside the Caddy perimeter (a managed network hole); and (c) hybrids. The Garage Range-request
check is the pivotal input: if Range works, the platform path may suffice and no hole-punching is
needed. This *exploration* — not a mount — is the album-critical-path prerequisite; the choice is
the operator's.

**Sequencing against the album schedule:**

- *Before album video work begins* — settle the **media-access architecture** (the exploration
  above: through-Caddy vs. direct mount vs. hybrid, pivoting on the Garage Range check) + tus
  upload + FFmpeg transcode. Settling how editors reach platform-stored footage is the album
  critical path.
- *During production* — **Level 2** (MLT XML + EDL project-file generation) and **Level 3**
  (proxy workflow) as footage volume warrants. They improve the loop but do not block the team.
- *Review bridge (D)* — build **only if** the team needs to review work-in-progress cuts before
  the later levels land, **or** if version identity is already in B's scope (which collapses most
  of D's cost). Otherwise defer — D is not on the album critical path.
- *Post-album / when warranted* — **Level 4** (cloud `melt` render service on the host) and any
  separate OpenShot/`.osp` track.

**Real-time co-editing:** out of scope (no production CRDT/OT for timelines).

The operator supplies the concrete dates and the "must-land-by" line; the structure above maps
the build ladder and the D-vs-B call onto the album's phases without fabricating a calendar.

## Open questions (carried, not closed)

- Does Garage return Range-request support on presigned GET URLs? (Resolves the HTTP-path tension.)
- Media-access architecture: keep editors' media access *through* the platform/Caddy perimeter, or
  grant a direct storage-array mount — and if the latter, how to expose it without an unmanaged
  network hole (VPN, segmented VLAN, scoped export)? Pivots on the Garage Range answer.
- Both originally-blocking Resolve sources are now substantially discharged: the scripting README
  (`-nogui` headless scripting works [resolve-scripting-readme]{1}) and the Reference Manual
  interchange set (AAF/EDL/XML/DRT/ADL/OTIO import; OTIO/AAF/XML/EDL export; OTIO native)
  [resolve-manual-interchange]{1}. Residual: AAF marker round-trip *fidelity* detail only.
- Is version identity already in scope for B? (Drives the D-bridge sequencing call.)

## Revisit if

- Garage presigned URLs are confirmed to honor Range requests — upgrades the HTTP-redirect path
  from "conditional" to a viable render-media source alongside mounted storage.
- The Blackmagic scripting README / Reference Manual become accessible — confirms Resolve's
  GUI-requirement and interchange specifics.
- Kdenlive's native HTTP-URL clip-import UI support is confirmed, or OpenShot documents a headless
  render workflow — either changes the integration-complexity picture for that editor.
- A team member's primary editor is confirmed (Kdenlive / Shotcut / Resolve / FCP) — narrows the
  primary-target weighting.
- B's scope is settled with version identity included — collapses part of the D-bridge cost.
