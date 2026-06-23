---
status: settled
authored: 2026-06-23
provenance: agent-synthesis
related:
  - to: ../campaigns/video-production-media-hub/parent.md
    type: grounds
    note: full-rigor 4-facet campaign (OSS editor matrix, Resolve/proprietary, infra/render backends, review bridge); all verification gates passed; both blocking Resolve sources discharged post-hoc; carries the [handle]{N} derivation
  - to: garage-object-storage.md
    type: cites
    note: Garage stores the media editors consume; its Range-request behavior gates the through-Caddy media path
  - to: srs-streaming-server.md
    type: cites
    note: the streaming stack the sibling Twitch-parity clipping surface rides (separate engagement)
revisit_if:
  - The Garage presigned-URL Range-request check resolves (the `verify-garage-presigned-range-support` story). If Range is honored, the through-Caddy HTTP media path becomes viable for editing/render and the media-access architecture can settle toward it; if not, the mount / cloud-workstation options carry more weight.
  - A media-access architecture is chosen (through-Caddy HTTP / direct mount / server-side cloud-workstation). This position deliberately leaves it OPEN; settling it promotes a follow-on stance and may re-rank editors (the cloud-workstation path favors Kdenlive's FOSS / no-per-seat-license profile; a mount path re-admits Resolve cleanly).
  - The cloud-workstation approach (server-side Kdenlive behind a browser remote desktop) is researched and grounded — currently an unverified candidate set (KasmVNC / Selkies-GStreamer / Apache Guacamole + GPU passthrough on Proxmox).
  - A team member standardizes on DaVinci Resolve as primary editor. Resolve is supported as an interchange consumer (native OTIO / AAF / EDL / XML) but cannot open HTTP URLs, so it pulls toward a mount; a Resolve-primary team would re-weight the architecture.
  - Kdenlive's UI HTTP-clip-import is confirmed or denied (the render path over HTTP is confirmed; interactive UI import is not), or Kdenlive's OTIO effect-transfer limitations change.
  - The sibling stream-clipping (Twitch-parity) engagement runs and shifts the shared media/storage assumptions.
---

# Position: Kdenlive + Shotcut as the primary video-production editors; platform as media hub, not an NLE

**Status: settled** for the editor selection and the integration posture. The media-access
*architecture* is deliberately held open — see §Open. Grounded in the full-rigor
`video-production-media-hub` campaign (linked under `related:` — it carries the citation
derivation).

## The stance

For video production (near-term driver: album-release video), the platform integrates with
**desktop editors as a storage + review + delivery hub** — it does **not** build an in-browser
NLE. The differentiator is platform-integrated storage/review/delivery, not a better editor.

### Editor tiers (settled)

- **Primary — Kdenlive + Shotcut.** Both are MLT XML, so a single headless `melt` service renders
  both. Kdenlive adds native C++ OTIO since 25.04; Shotcut adds hash-matched proxy. Both read
  mounted-filesystem media cleanly and can reference HTTP URLs in project files (render-path
  confirmed; interactive UI clip-import unconfirmed).
- **Access + interchange consumer — DaVinci Resolve.** Supported for a team member who already
  uses it: native **OTIO** import/export plus AAF/EDL/XML/DRT/ADL, and headless render via a
  *managed* `-nogui` scripting process (Studio). Caveat: Resolve **cannot open HTTP URLs** — it
  needs a filesystem path, so it pulls toward a mount.
- **Secondary — OpenShot.** Active and credible but architecturally distinct (`.osp` JSON,
  `libopenshot`, no `melt` path, undocumented headless render) — a separate integration track,
  only if a team member needs it.
- **Niche — Blender VSE.** Robust native headless render, but the binary `.blend` format means
  platform-side project generation needs Blender itself — motion-graphics work, not general NLE.
- **Excluded — Olive** (stagnant since 2023) and **Flowblade** for automation (`.flb` Python
  pickle, no headless CLI).

### Integration posture (settled)

- **Platform as media hub, not an NLE.**
- **Stay behind Caddy where possible**, which **skews toward deeper platform integration** (the
  platform owns media access, proxies, project-file generation, and ideally server-side render)
  and **reinforces the MLT-editor pick** — Kdenlive/Shotcut consume HTTP natively, so they fit the
  behind-Caddy model; Resolve can't, so it is the one editor that wants a mount.
- **Real-time timeline co-editing is out of scope** — no production-grade CRDT/OT for video
  timelines exists; the production leader (Resolve) uses lock-and-merge.

## Open (deliberately not settled): the media-access architecture

How editors reach platform-stored media is **unsettled and must not be pre-committed** — three
candidates, none chosen:

- **(a) Through the platform HTTP layer (behind Caddy)** — the redirect endpoint; render is
  confirmed (FFmpeg follows the 302); editing viability hinges on Garage honoring Range requests.
- **(b) Direct storage-array mount** (NFS/SMB/rclone) — robust for seeking, but exposes storage
  to edit workstations *outside* the Caddy perimeter (a managed network hole).
- **(c) Server-side cloud workstation** — Kdenlive running on the host behind a browser remote
  desktop; maximal capability, media stays server-side, access stays behind Caddy; tooling
  unverified (a research follow-up).

The pivotal input is the **Garage Range-request check** (tracked as
`verify-garage-presigned-range-support`). If Range works, (a) may suffice and no hole is punched.
See `revisit_if`.

## Rejected alternatives

- **Build an in-browser NLE** — the differentiator is integration, not building an editor; high
  cost. The in-browser timeline-UI-library path was de-scoped.
- **Olive / Flowblade as integration targets** — stagnant / opaque binary formats with no
  headless CLI render.
- **Hosted render APIs (Shotstack / Creatomate) or Remotion** — vendor dependency / restrictive
  licensing, counter to cooperative values.

## Accepted trade-offs

- MLT-primary means the `melt` headless render needs `xvfb` for titles; OTIO interchange does not
  transfer effects/filters (cut-exchange only).
- Resolve support is interchange-only; the platform never calls Resolve in its core pipeline
  (FFmpeg handles server-side render).
- The media-access architecture is left open — a deliberate not-yet-stance pending the Range check
  + cloud-workstation research, rather than committing to bypass the platform.

## Platform constraints it sets

- The MLT editors share one render backend (`melt`); a render service is a single integration, not
  per-editor.
- Project files (MLT XML + EDL) are generable directly in Node — no Python/OTIO sidecar unless the
  platform later needs to *ingest* FCP XML / AAF.
- Proxy workflow becomes load-bearing under a behind-Caddy architecture (cheap editing media).
