---
id: stream-clipping-twitch-parity
kind: feature
stage: drafting
tags: [research, streaming, content]
parent: null
depends_on: []
release_binding: null
gate_origin: null
research_origin: null
research_refs: []
created: 2026-06-23
updated: 2026-06-23
research_dials:
  scope_authority: mixed
  verification_rigor: full
  intent: inform-decision
  output_kind: [synthesis-brief, build-recommendation]
---

# [research] Stream/VOD clipping — creator + viewer clips (Twitch parity)

## Brief

Research the clipping surface that moves the platform toward **feature parity with Twitch** —
turning live streams and VODs into short shareable clips, **including viewer-created clips**, not
only creators clipping their own streams. This is a primary platform surface but **not
album-timeboxed** — distinct urgency from the video-production media hub (the "B" surface, scoped
separately as the sibling engagement `video-production-media-hub`). This is the "A" surface.

This is a `[research]` engagement: an input that grounds the clipping build decisions, not a
shippable deliverable. It does not bind to a release; verification gates run inline
(`research_completion: close-to-done`). It routes to `agentic-research:research-orchestrator`.

### Framing constraint (set with user at scoping, 2026-06-23)

**Architecture is not a hard blocker** — the available infrastructure (a Proxmox host + storage
array) is broader than the web platform, and the render/storage backend for clips may run
host-level rather than only via Garage. Clipping is nonetheless **more inherently
platform-coupled** than the editor-integration surface: viewers are authenticated platform users,
and clips need the web UI, the player, and a discovery surface. Keep the backend open; assume the
platform's auth/web layer for the user-facing parts.

### Why a full-replace (partial)

The pre-ARD brief `.research/analysis/briefs/video-editing-tools.md` (dated 2026-04-16, no
attestation/citations/adversarial pass) covers the Tier-1 VOD-clipping + browser-side surface.
This engagement **full-replaces the clipping + browser-side parts**; treat them as prior
hypotheses. The brief's in-browser-NLE / timeline-UI-library material (the "C" surface) is
**de-scoped** (settled 2026-06-23, recorded in the sibling `video-production-media-hub`
engagement) and lapses with the replace.

## Engagement questions

### Q1 — Clipping mechanics & UX (source-verified)

Creator-clips-own-stream **and** viewer-clips-a-moment. In/out selection on both live and VOD; the
FFmpeg stream-copy vs. transcode path (the cheap-clip path — no re-encode when codecs match);
clip-as-content-item data model. Latency question: how soon after a live moment can a clip be cut
(live-edge vs. VOD-after-the-fact), and what the streaming stack permits.

### Q2 — Viewer-generated-clip product surface (the genuinely new part)

The part the prior brief barely touched. Permissions (who can clip what; per-stream clip
enable/disable), attribution to the streamer, the clip's own shareable page (+ OpenGraph/preview),
a discovery feed, moderation of viewer-generated content (report/remove), and storage-cost posture
(retention, dedup, the cost of many short clips). What Twitch does, and which parts actually matter
for a multi-stakeholder cooperative.

### Q3 — Riding the existing stack

What's reusable vs. new on the current stack: SRS (VOD / DVR / rewind), Garage storage, the
Vidstack player, pg-boss jobs. The streaming backlog intersects here — the SRS DVR/rewind and
low-latency-WebRTC items in particular; note feasibility/shape interactions.

### Q4 — Build recommendation + Twitch parity-gap read (adversarially refuted)

Scope an MVP clip surface vs. the full viewer-UGC product, with a clear parity-gap read against
Twitch. Subject to adversarial refutation: storage-cost blowup from viewer clips, moderation
burden, rights/attribution edge cases, the live-edge latency limit.

## Substrate already in hand

- **Prior pre-ARD brief (clipping parts are hypotheses):**
  `.research/analysis/briefs/video-editing-tools.md`.
- **Streaming positions:** `.research/analysis/positions/srs-streaming-server.md`,
  `.research/analysis/positions/tv-model-playout-architecture.md`,
  `.research/analysis/positions/vidstack-media-player.md`,
  `.research/analysis/positions/garage-object-storage.md`.
- **The streaming backlog** — DVR/rewind, low-latency-WebRTC, and related VOD items that the
  clipping surface rides on.

## Dials (proposed — confirm with user at orchestrator kickoff)

- **scope_authority: mixed** — Q1–Q4 are fixed; the viewer-UGC product surface (Q2) is a discovery
  area where Twitch-parity features may surface beyond those enumerated.
- **verification_rigor: full** — the stream-copy/transcode path, live-edge latency, and stack
  reuse claims are verified against the streaming stack + SRS sources; the build recommendation
  gets adversarial refutation.
- **intent: inform-decision** — scope the clip surface (MVP vs. full viewer-UGC) and the build path.
- **output_kind: synthesis-brief + build-recommendation**.

## Output destination

`.research/analysis/`. On completion this **full-replaces the clipping/browser parts** of
`video-editing-tools.md` (the C parts having already lapsed) — the operator-confirmed
`research-handoff` may emit follow-up `.work/` items (an MVP clip feature, a viewer-clip
permissions/moderation story) carrying `research_origin: stream-clipping-twitch-parity`.
