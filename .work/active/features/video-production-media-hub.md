---
id: video-production-media-hub
kind: feature
stage: done
tags: [research, content, media-pipeline]
parent: null
depends_on: []
release_binding: null
gate_origin: null
research_origin: null
research_refs: [video-production-media-hub]
created: 2026-06-23
updated: 2026-06-23
research_dials:
  scope_authority: mixed
  verification_rigor: full
  intent: inform-decision
  output_kind: [selection-recommendation, synthesis-brief]
---

# [research] Video-production media hub — editor integration + (conditional) review bridge

## Brief

Choose which editor(s) the platform's **video-production workflow** integrates with, and settle
the integration depth — driven by the pressing near-term need: producing video for the album
release (S/NC Records' *Animal Future*). The platform's role here is the storage + review +
delivery hub *around* the production team's real editors (the "B" surface). The companion
viewer/creator clipping surface ("A") is scoped separately — see the sibling engagement
`stream-clipping-twitch-parity`.

This is a `[research]` engagement: an input that grounds the editor + integration-depth +
sequencing decisions, not a shippable deliverable. It does not bind to a release; verification
gates run inline (`research_completion: close-to-done`). It routes to
`agentic-research:research-orchestrator`.

### Two framing constraints (set with user at scoping, 2026-06-23)

1. **Architecture is not a hard blocker.** The decision axis is integration-fit with the
   **available infrastructure** — a Proxmox host + a broadly-available storage array — not
   specifically the web platform's Garage S3 layer. The web platform + auth is *one access layer*
   on top of that infrastructure: an asset to leverage where it helps, not a boundary to design
   around. The research is free to recommend a tool/service running directly on the host,
   direct storage-array access (NFS/SMB/iSCSI/rclone) instead of only Garage-over-HTTP, or a
   library/tool that implies a different architectural path — whichever best serves the
   production workflow. Treat the platform's auth/web surface as a benefit, not a requirement.
2. **D (review/approval) is a conditional bridge, not a fixed deliverable.** If the deeper B
   integration lands quickly, an interim review surface is largely unnecessary. So sequencing is
   a genuine question: how fast can we get to *usable* B, and is the D bridge worth building at
   all given that.

### Why a full-replace

The prior brief *nle-platform-integration.md* (deleted 2026-06-23 on full-replace) was **pre-ARD**
(dated 2026-04-16): no per-source attestation, no `[handle]{N}` citation chain, no adversarial
pass. Its rigor was not trusted for a selection decision. This engagement **full-replaces** it —
treat its content (the Kdenlive/Shotcut MLT-XML strategy, the redirect-endpoint media URLs, the
Level 1–4 ladder, the Resolve Free/Studio split, the Clapshot/Frame.io references) as prior
hypotheses to verify or overturn, not as settled findings. On completion the pre-ARD brief is
deleted (operator-confirmed via `research-handoff`, or by hand at close).

### Enumeration is known-incomplete

The prior matrix omitted **OpenShot** (free GPL editor). That omission is why scope_authority is
`mixed` — the candidate set is itself a discovery surface. OpenShot does **not** use the MLT
backbone the prior strategy rests on (it is built on `libopenshot`/FFmpeg with a JSON `.osp`
project format), so its integration story needs its own grounding.

## Engagement questions

### Q1 — Editor matrix, production-team lens (source-verified, full-replace)

Re-verify and **extend** the editor matrix against primary sources, **weighted to what the
S/NC Records / studio production team actually uses or would adopt** for the album work. For each
candidate source-confirm: license, project-file format, headless/CLI render path, media-access
options (including **host-level / storage-array-direct** access, not only HTTP/S3), OTIO
import/export, proxy support, and maintenance health.

- **Re-verify:** Kdenlive, Shotcut, Blender VSE, DaVinci Resolve (Free + Studio), Olive.
- **Add (the known gap):** **OpenShot** — `libopenshot` Python-binding headless render, the `.osp`
  format, how it reads remote/mounted media, OTIO support.
- **Discovery (mixed-scope authorizes this):** scan for editors the prior enumeration missed
  (Flowblade, Pitivi/GES, Cinelerra, others); justify inclusion/exclusion.

### Q2 — Integration depth, infrastructure-open

Re-validate the build ladder (media hub → project-file generation → proxy workflow → cloud
render) **through the architecture-not-a-blocker lens**. For each level, weigh the
platform-coupled path (Garage S3 + redirect endpoints, Node-side project-file generation) against
**host-level / storage-array-direct alternatives** (a render or sync service on the Proxmox host,
the storage array mounted into the editor's filesystem, an alternative render backend such as
`melt`). Which path best serves the album workflow on value-per-effort.

### Q3 — The conditional D bridge (build it, or race to B?)

What is the minimum review/approval surface (timestamped comments, approval states, version
compare) that would unblock the album team in the interim — **and**, given constraint (2),
whether it is worth building *at all* versus racing straight to usable B. Frame explicitly as
**time-to-usable-B vs. cost-of-the-D-bridge**. Note where a review surface would generalize
beyond the album (reviewing any uploaded content, or viewer clips from the sibling engagement) —
as a forward pointer, not in-scope to build here.

### Q4 — Selection + sequencing recommendation (adversarially refuted)

Which editor(s) to support, which integration path (platform-coupled vs. host-level), and whether
to build the D bridge or skip it — anchored to the album-release timeline. Subject the
recommendation to adversarial refutation: what breaks the chosen path, what the prior brief got
wrong, what a future maintainer regrets.

## De-scoped (settled 2026-06-23, do not re-litigate)

**C — in-browser NLE / timeline-editing in the web app — is out of scope.** Recorded here so a
discovery pass does not reopen it. The in-browser-editing + timeline-UI-library material in the
pre-ARD `video-editing-tools.md` brief lapses with the replace (its clipping parts move to the
sibling `stream-clipping-twitch-parity` engagement).

## Decomposition (Checkpoint A — confirmed 2026-06-23)

Candidate C (hybrid 4-facet) chosen over A (by-engagement-question — Q2 integration-depth is
coupled to Q1, splitting one investigation) and B (by-editor-family — 5 facets, smears the
integration-fit axis). Four parallel research-specialist facets; Q4 (selection + sequencing) is
lead cross-synthesis:

1. **`oss-editor-integration`** — OSS matrix (Kdenlive, Shotcut, OpenShot, Blender VSE, Olive +
   discovery: Flowblade/Pitivi) fused with each editor's integration affordances (project format,
   headless render, media access incl. host/storage-array). Load-bearing facet.
2. **`resolve-and-proprietary`** — DaVinci Resolve Free/Studio: automation paywall, scripted
   import, rclone/storage-array mount, EDL/OTIO interchange.
3. **`infra-and-render-backends`** — caveat-2: Proxmox-host / storage-array-direct paths, headless
   render services (`melt`, `libopenshot`, Blender CLI), proxy-workflow mechanics, Node-side
   project-file generation.
4. **`review-collab-bridge`** — caveat-1 (the D facet): OSS review references (Clapshot, the
   Frame.io model), the minimum review surface, build-vs-race-to-B sequencing input.

Seam to watch: facet-1 ↔ facet-3 (per-editor capability vs. editor-independent infra/render
substrate); the Q4 cross-join reconciles. Output:
`.research/analysis/campaigns/video-production-media-hub/`.

## Substrate already in hand

- **Adjacent codec context:** `.research/analysis/briefs/video-codec-compatibility.md`. (The
  prior pre-ARD brief *nle-platform-integration.md* — hypotheses, not findings — was deleted
  2026-06-23 on full-replace.)
- **Platform storage + player positions:** `.research/analysis/positions/garage-object-storage.md`,
  `.research/analysis/positions/vidstack-media-player.md`.
- **Shipped file-sharing primitives:** the tus resumable-upload feature
  (`.work/releases/0.3.0/features/resumable-uploads-tus.md`) and the FFmpeg media pipeline.
- **The deployment infrastructure:** a Proxmox host + storage array on which the platform runs —
  available broadly, not confined to the web app (constraint 1).

## Dials (proposed — confirm with user at orchestrator kickoff)

- **scope_authority: mixed** — Q1–Q4 are fixed must-answer deliverables; the candidate set and
  the integration-path space (platform-coupled vs. host-level) are explicit discovery surfaces.
- **verification_rigor: full** — every capability claim verified against primary sources; the
  recommendation gets full adversarial refutation. (The whole reason for the engagement is that
  the pre-ARD brief lacks trusted rigor.)
- **intent: inform-decision** — choose the editor(s) + integration path + the D-bridge call.
- **output_kind: selection-recommendation + synthesis-brief** — a `.research/analysis/` synthesis
  (brief/landscape, or a campaign bundle if fan-out warrants) plus a crisp recommendation.

## Output destination

`.research/analysis/`. On completion this **full-replaces** `nle-platform-integration.md` — the
operator-confirmed `research-handoff` deletes it and may emit follow-up `.work/` items (the chosen
integration levels, an OpenShot/`.osp` generator spike, a D-bridge review feature if the
sequencing call favors it) carrying `research_origin: video-production-media-hub`.

## Engagement record (closed 2026-06-23)

Ran end-to-end through `agentic-research:research-orchestrator`. Dials honored as scoped
(scope_authority: mixed · verification_rigor: full · intent: inform-decision · output_kind:
selection-recommendation + synthesis-brief).

- **Decomposition:** Candidate C (hybrid 4-facet), confirmed at Checkpoint A.
- **Fan-out:** 4 parallel research-specialists — `oss-editor-integration`, `resolve-and-proprietary`,
  `infra-and-render-backends`, `review-collab-bridge`. ~40 source-direct attestations authored.
- **Verification (full rigor):** lint (floor — citation chains resolve; residual "broken" are
  URL-liveness `unreachable-source` at low severity on bot-blocking sites) → adversarial-read
  (NEEDS-REVISION: 2 §1 citation defects, fixed) → evaluate (isolated; NEEDS-REVISION: Q4
  album-timeline anchoring gap + 3 uncited clauses + consolidated recommendation, all fixed) →
  spot-check (clean).
- **Output:** `.research/analysis/campaigns/video-production-media-hub/` — `parent.md` (synthesis +
  sequenced recommendation), 4 specialist briefs, `acquisitions.md`, `verification-checklist.md`,
  `campaign-evaluation.md`.

### Headline outcomes

1. **Primary editors: Kdenlive + Shotcut** (one shared `melt` headless render path). OpenShot is a
   real but architecturally-distinct secondary (no `melt` path); Resolve is storage + interchange
   only (scripting Studio-only, no confirmed headless render); Olive/Flowblade excluded for
   automation.
2. **The "architecture is not a hard blocker" caveat is load-bearing:** the mounted storage-array
   path (NFS/SMB from the Proxmox host, or rclone VFS-full) is the robust media path for every
   editor — the web-platform HTTP-redirect path has a seek limitation and is conditional on Garage
   Range-request support (the key open acquisition).
3. **D (review bridge) is genuinely deferrable** — platform-layer, independent of the editor path;
   the build-vs-race call hinges on whether version identity is already in B's scope.
4. **Full-replace pending:** on operator confirmation the grounded output supersedes the pre-ARD
   `nle-platform-integration.md`.

### Follow-on (operator-gated)
- Run `/agentic-research:research-handoff video-production-media-hub` to emit grounded `.work/`
  items (Level-1 mounted-storage media access; the Garage Range-request verification; a D-bridge
  review feature if sequencing favors it) and delete the superseded pre-ARD brief.
- `acquisitions.md` carries the remaining blocking source (Resolve Reference Manual, login-gated)
  + enriching candidates incl. the load-bearing Garage Range-request doc.

### Post-closure enrichment (2026-06-23)

One of the two blocking acquisitions was discharged after close: the **Resolve scripting README**
was obtained from a verbatim community mirror (corroborated against a second mirror), attested as
`resolve-scripting-readme`, and folded back into the brief + parent (re-linted clean). It
**overturns headline outcome #1's "no confirmed headless render"**: Resolve runs headless via
`-nogui` with the scripting APIs (incl. render methods) still working — though "running" is still
required (a managed headless process, not a stateless CLI). Scripting is a common Free+Studio
superset with Studio-gated functions returning False in Free (single-mirror; assume Studio for
full automation in practice). The **second** blocking source — the **Reference Manual** — was
then also discharged from an HTML mirror of the Resolve 18.6 manual (attested
`resolve-manual-interchange`): Resolve imports AAF/EDL/XML/DRT/ADL/**OTIO** and exports
OTIO/AAF/XML/EDL (+ CDL/ALE/edit-index), with **OTIO native** (no third-party adapter) and markers
exporting to EDL. **Both originally-blocking Resolve sources are now discharged;** the only residual
is AAF marker round-trip *fidelity* detail (minor). All folded back + re-linted clean.

### Handoff outcome (2026-06-23)

The handoff landed as a **position promotion**, not a backlog of build work — the engagement was
`inform-decision` and the operator is not committing to build yet. Outcome:

- **Position promoted:** `.research/analysis/positions/video-editor-integration.md` — settled
  editor selection (Kdenlive + Shotcut primary; Resolve interchange consumer; OpenShot secondary;
  Olive/Flowblade excluded) + media-hub-behind-Caddy posture; the media-access architecture is
  held **open** (revisit conditions).
- **One tracked story:** `verify-garage-presigned-range-support` — the pivotal Garage Range check
  that gates the open architecture decision.
- **Build items held:** the project-file-generation / proxy / D-bridge / cloud-render ladder is
  not emitted as backlog work until there is build intent (it lives in the position + campaign).
- **Superseded brief deleted:** the pre-ARD `nle-platform-integration.md` (full-replace complete).
