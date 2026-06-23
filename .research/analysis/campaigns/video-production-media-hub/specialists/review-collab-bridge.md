---
title: "Review/Collab Bridge — D Facet"
campaign: video-production-media-hub
specialist: review-collab-bridge
provenance: agent-synthesis
updated: 2026-06-23
sources:
  - clapshot-readme
  - clapshot-features
  - clapshot-metaplugins
  - frameio-review-model
  - frameio-unified-review
  - davinci-collab-arch
  - crdt-production-landscape
---

## Scope

This brief covers: the D facet of the B+D engagement — the conditional review/approval bridge for the SNC platform. Specifically: (1) OSS self-hosted video review tools (Clapshot and alternatives), (2) the Frame.io industry pattern as the reference model, (3) what a minimal review surface for a small production team genuinely requires, (4) the build-vs-race-to-B sequencing question, and (5) the current state of CRDT/OT for video-editing timelines.

---

## 1. OSS Self-Hosted Video Review Tools

### Clapshot

Clapshot (`elonen/clapshot`, GPLv2) is the only actively maintained open-source self-hosted video review tool with a meaningful feature set as of mid-2026. It is described as "self-hosted web based collaborative video review tool" [clapshot-readme]{1}.

**Architecture** [clapshot-readme]{2}:
- Server: Rust daemon
- Client: Svelte SPA communicating over WebSocket
- Database: SQLite (metadata, comments, user messages)
- Media: FFmpeg + Mediainfo for transcoding and thumbnail generation
- Auth: reverse proxy integration (OAuth, JWT, Kerberos, SAML) — not bundled
- Plugin system: Organizer plugins via gRPC (any language); metaplugins via Python drop-in

**Core review capabilities** [clapshot-features]{1}:
- Timecoded comments: threaded conversations anchored to video timestamps; appear as clickable pins on the video timeline with color-coded user identification; SMPTE timecode display with editable fields
- Drawing annotations: 7-color palette; undo/redo; auto-pause on drawing entry; drawings saved as WebP images linked to timestamps
- Real-time sync: playback, seeking, and drawing operations synchronized across collaborative session participants (designed for conference-call use)
- EDL import as time-coded comments
- Notification hook (v0.11.1): event-driven external script invocation on comment and media file events — suitable for email/Slack notification

**What Clapshot does NOT have out-of-the-box** [clapshot-features]{2}:
- Approval workflow states (approved / needs work / in review) — absent from FEATURES.md; referenced only as an example of what a custom Organizer plugin *could* implement
- Version history / version comparison for uploaded media assets — not present
- Anonymous/guest review links (token-based folder sharing exists but requires authentication)

**Approval via plugin**: Clapshot's Organizer plugin system supports "organization-specific workflows (approval flows, archiving, custom integrations)" [clapshot-metaplugins]{1}, but this requires either a full gRPC Organizer or external state storage. Metaplugins cannot natively add structured status fields to the data model — they operate through popup menu actions and JavaScript data injection [clapshot-metaplugins]{2}. The Organizer API is explicitly flagged as "new, still evolving and may change in future releases" [clapshot-metaplugins]{3}.

**Licensing note**: Clapshot's GPLv2 license on the server and client means any modifications to those components must also be GPLv2. The gRPC plugin interface is MIT, meaning custom Organizer plugins can be proprietary. Integration with the SNC platform via the plugin API avoids the GPLv2 copyleft for platform-side code.

**Stars/activity**: 250 stars on GitHub; last release v0.11.1 on 2026-06-04 [clapshot-readme]{3}. Actively maintained.

### Other OSS Alternatives

**MyFrame** (`KyleTryon/MyFrame`, Vue/JavaScript): described as "A local open source alternative to Frame.io." Archived as read-only in April 2021 with only 2 commits and 8 stars. Not maintained; not viable [web search, fetched 2026-06-23].

No other production-ready OSS self-hosted video review tools with timecoded annotation surfaced in the search. Clapshot is the field.

---

## 2. The Frame.io Reference Pattern

Frame.io is the industry reference for collaborative video review. Its model as documented in its own help center [frameio-review-model]{1} and unified review documentation [frameio-unified-review]{1}:

### Approval State Model

Three-state decision per approver [frameio-review-model]{2}:
- **Approved** — asset needs no changes; ready for use
- **Approved with changes** — minor revisions needed; does NOT require re-approval after updates
- **Needs Work** — changes required; asset must be uploaded as a new version and go through another approval round [frameio-unified-review]{2}
- **No response** — approver has not yet decided

Asset reaches "approved" status only when all assigned approvers choose "approved" [frameio-review-model]{3}.

### Role Distinction

- **Reviewer**: can comment and annotate; marking review complete is optional, not required to advance the workflow
- **Approver**: must make a binding decision to advance the process [frameio-unified-review]{3}

### Timecoded Comments and Frame Annotations

"Comments, annotations and text markup tools, including pinned comments and frame-accurate timestamp comments for video" [frameio-review-model]{4}. Comments are anchored to specific video frames/timecodes — this is the core review primitive.

### Version Comparison

Side-by-side asset review; pixel difference and overlay slider comparison for like-to-like file types and sizes [frameio-review-model]{5}.

### Multi-Stage Approvals

Multi-stage approvals supported; the same approver can appear in multiple stages [frameio-review-model]{6}.

### Architectural Separation

Frame.io separates the annotation surface (the viewer, timecoded comments, frame drawings) from the approval state tracking (Workfront handles workflow coordination; Frame.io handles the review UI) [frameio-unified-review]{4}. This separation is architecturally significant: the two concerns are decoupled and can be built independently.

---

## 3. Minimum Review Surface for a Small Production Team

Drawing from the Frame.io pattern [frameio-review-model]{1} [frameio-unified-review]{1} and Clapshot's capabilities [clapshot-features]{1} [clapshot-readme]{1}, the genuinely minimal capabilities to unblock collaborative review for a small team are:

### Capability 1: Timecoded commenting
- Comments anchored to video timestamps (a specific frame/second)
- Player synchronizes to comment timestamp on selection
- **Architectural requirement**: a comment table with at minimum `video_id`, `user_id`, `timestamp_seconds` (or timecode), `body`, `created_at`; the media player must expose a `currentTime` API and accept a seek target — Vidstack exposes both [platform context, lens only].

### Capability 2: Approval states per asset version
- A publish-state progression: draft → in review → approved (+ needs work as a return path)
- **Architectural requirement**: a `review_state` column (or enum) on the asset/version record; state transition logic (who can advance it); notification on state change. Separate from the comment table — these are independent concerns.

### Capability 3: Version identity
- Each upload of a revised asset treated as a new version, not an in-place replacement
- Needed to: correctly scope comments to the version they were left on; enable the "needs work → new version → re-review" cycle
- **Architectural requirement**: a version reference on each asset record; comments scoped to version_id

### Capabilities that are enriching but not minimal
- Frame-accurate drawing/annotation on frames (enriches but not required to unblock async review)
- Version diff/comparison (enriching; requires like-for-like assets)
- Real-time co-viewing (enriching; Clapshot's conference-call mode)
- Multi-stage multi-approver routing

### What Clapshot already provides vs. what is missing

| Capability | Clapshot out-of-box | Gap |
|---|---|---|
| Timecoded comments | Yes — timeline pins, threaded, SMPTE | — |
| Drawing annotations | Yes — 7-color, real-time sync | — |
| Real-time co-viewing | Yes — conference-call mode | — |
| Approval states | No | Requires plugin or custom build |
| Version history/compare | No | Not present |
| Guest/anonymous review links | No | Auth required |
| Notification hooks | Yes (v0.11.1) | Needs integration wiring |

Clapshot provides the annotation and commenting surface of the Frame.io pattern but not the approval workflow layer.

---

## 4. Build-vs-Race-to-B Sequencing Question

D is a conditional bridge: if the deeper editor integration (B) lands quickly, an interim review surface may be unnecessary. The inputs to that decision:

### What a minimal review surface needs (relative anchors)

From the analysis above, the minimal D surface has three distinct components:
- A comment data model with timestamp anchor (additive to existing platform data model; comparable in scope to a comment/reaction feature on any content type)
- An approval state field on the asset version record (a small schema addition; state machine with 4 states)
- Version identity on assets (may already be partially present if the platform's content model tracks publish states; this is the component most likely to overlap with work needed for B regardless)

None of these have inherent dependencies on the editor integration path. They are platform-layer concerns, not editor-integration concerns.

### What the B path needs

B (editor integration) is a separate facet of this engagement and its scope is not attested here. However, based on the platform context (lens only): editor integration typically requires a round-trip protocol — export from editor, ingest to platform, potentially export back. This is distinct from the review surface.

### The sequencing input

The decision to defer D hinges on:
1. **How quickly B lands**: if B is near-complete and the team has no blocking review need in the interim, D as a separate surface may add unnecessary surface area
2. **Whether Clapshot is the D path**: if adopting Clapshot (self-hosted, GPLv2, separate service), the integration cost is non-trivial (auth bridge, storage bridge, notification wiring). If D is a native platform feature (comment table + state field), it is additive to existing data model work
3. **Whether version identity is shared**: if B also requires version tracking for round-trips, building version identity is not D-specific work — it would be done for B regardless

**Open question for human estimation**: Is version identity already in scope for B? If yes, that component drops out of D's build cost, making D's remaining work (comment table + state field) relatively small by comparison.

**Forward pointer**: A review surface built for album release can generalize to reviewing any uploaded content on the platform (other releases, viewer-generated clips). This generalization is not in scope here but should be considered when scoping the data model (avoid album-specific coupling).

---

## 5. Real-Time Co-Editing of Video Timelines (CRDT/OT State)

The prior internal hypothesis: no production-grade CRDT/OT implementation exists for video-editing timelines; defer indefinitely.

**Current state against primary sources:**

Production NLE collaboration (DaVinci Resolve) uses a **lock-based model**, not CRDT or OT [davinci-collab-arch]{1}:
- Automatic bin and timeline locking ("read only until unlocked by current user")
- Clip-level auto-lock during grading
- Visual timeline comparison/merge tools for accepting changes
- Live save of incremental changes to a project database
- Explicitly no CRDT/OT on the Blackmagic product page

CRDT production deployments in 2026 are named across text editing (Figma, Notion, Linear, Google Docs alternative surfaces) but **no video editing or NLE timeline application appears in the CRDT production literature** [crdt-production-landscape]{1}. The most capable CRDT libraries (Yjs, Automerge 2.0, Loro) target text, rich text, lists, maps, and movable trees — not video timeline sequences [crdt-production-landscape]{2}.

Academic search for "video timeline CRDT" or "NLE CRDT" returned no papers specifically targeting video editing timelines. The closest related work is geospatial CRDT and rich text CRDT (Peritext), neither of which maps to an NLE timeline model.

**Assessment**: The prior hypothesis is confirmed by current primary sources. No production-grade CRDT/OT implementation for video-editing timelines exists as of mid-2026. The production standard (DaVinci Resolve) uses locking + merge, and the CRDT ecosystem has not addressed the NLE timeline problem.

A video editing timeline has distinct challenges compared to text or structured documents: clips are positioned in continuous time rather than sequential characters; operations include split, trim, ripple-delete, and layer reorder — these do not map cleanly to the sequence CRDT data structures (RGA, Yjs sequences) designed for text.

**This confirms the prior position, grounded in current primary sources rather than cited from the prior internal hypothesis.**

---

## Disconfirming Analysis

**Against Clapshot as the D path**: Clapshot's GPLv2 license creates a copyleft constraint on modifications to server/client. Any fork or derivative of the core would need to be GPLv2. If the SNC platform needs deep integration (native auth via the platform's identity layer, storage in the platform's PostgreSQL rather than SQLite, REST API interop with the platform's content model), the integration path is non-trivial — Clapshot is an independent service, not an embeddable library. The plugin system mitigates this for new workflow code, but the auth and storage architectures are distinct.

**Against treating Clapshot's missing approval workflow as a gap**: The approval state is a small schema addition. For a small production team with a known-small set of reviewers, "approved" can be as simple as a Slack message or an agreed convention. Whether the gap is blocking depends on team size and formality — for a single-label release with 3–5 collaborators, the absence of a formal approval button may be acceptable. This is a team-process decision, not a technical one.

**Against deferring D entirely (race-to-B)**: If B requires a review cycle during development (the team needs to review cuts before release), a review surface is needed regardless of whether B is finished. The timeline is: B under development → team needs to review work-in-progress cuts → no review surface → blockers on the release cycle. Whether that gap matters depends on whether the team will use review tooling during B development.

**Against the "no CRDT for NLE" conclusion**: The absence of evidence in web-accessible sources is not conclusive proof. Academic/preprint work on video timeline CRDTs could exist in conference proceedings not indexed by web search. However, no fetched source names such work, and the production landscape (DaVinci Resolve's lock-based approach as the field's leader) strongly corroborates the conclusion.

---

## Contradictions

No direct contradictions between sources. One tension:

- The search result summary attributed Clapshot's server language to "Rust" consistently; the GitHub API returns `language: TypeScript` as the primary language. This is not a contradiction — GitHub's language detection reports the largest byte-count language, which may be the Svelte/TypeScript client. The README and FEATURES.md explicitly state the server binary is written in Rust [clapshot-readme]{4}. Both are true; the tension is in GitHub's language field, not in the source material.

---

## Revisit If

- Clapshot ships a native approval workflow in a future release (the project is active; 3 releases in 2026 already)
- A CRDT library (Loro, Automerge, Yjs) announces video timeline support or an NLE project adopts CRDT for timeline sync
- The B facet's scope resolution reveals that version identity is already in scope for the editor integration path (changes the sequencing calculus for D)
- The team's production scale grows beyond a small team (e.g., multi-label, multiple concurrent releases) — the minimal review surface may need to scale to multi-stage multi-approver routing
