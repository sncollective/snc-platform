---
title: "Stream/VOD Clipping — Build Recommendation + Twitch Parity-Gap (creator + viewer clips)"
campaign: stream-clipping-twitch-parity
provenance: agent-synthesis
updated: 2026-06-24
output_kind: [synthesis-brief, build-recommendation]
specialist_facets:
  - clip-extraction-stack
  - viewer-ugc-product
  - clipping-comparators
---

# Stream/VOD Clipping — Build Recommendation + Twitch Parity-Gap

The decision this synthesis grounds: what a clipping surface (creator + viewer clips) looks like on
the S/NC stack, scoped MVP vs. full, with a parity read against Twitch/YouTube. The "A" surface,
companion to the editor-integration engagement.

## Headline

1. **For *stream-derived* clips, the #1 prerequisite is enabling SRS DVR.** The platform has **no
   persistent recording of live streams today** — `srs.conf` enables no DVR, and the HLS window is a
   10-second *ephemeral* delivery buffer that evaporates [srs-platform-conf]{1}, [srs-v6-hls-doc]{1}.
   YouTube's own docs confirm DVR is the substrate for live clips: "you can't create Clips from live
   streams without DVR" [youtube-clips-help]{1}. **Scope caveat:** clipping an *already-uploaded VOD*
   (a `content` item already in Garage) needs **no DVR at all** — FFmpeg extracts straight from the
   Garage object. So the cheapest first slice is "clip an existing VOD"; DVR is the gate only for
   clips *from live streams*.
2. **Reach YouTube-parity first, Twitch-parity later.** Clipping a recorded VOD after the stream
   (YouTube's model) is the direct first reach on a DVR recording. Twitch's **instant live-clip from
   a ~85-second rolling buffer** [twitch-clips-api-docs]{1} is the harder "full" target — it needs a
   much larger rolling *retention* buffer (far beyond today's 10s) **plus** low creation latency —
   two separate requirements.
3. **The extraction is cheap on the existing pipeline.** FFmpeg **stream-copy** (`-c copy`) cuts
   H.264+AAC clips with no re-encode [ffmpeg-main-seeking-copy]{1}, reusing the existing
   `processingJobs` + pg-boss + Garage pattern [platform-content-schema]{1}. The catch is
   keyframe-bounded precision (below).
4. **Viewer clips are mostly a product-surface build, not a hard technical one** — permissions,
   attribution, a clip page with social-card metadata, discovery, and moderation. The genuinely
   new platform concerns are **UGC moderation + DMCA §512 safe harbor** and **storage at scale**.

## 1. Extraction mechanics (Q1)

**Live-edge vs. VOD, and the rewind depth.** Today only the HLS rolling window exists — `hls_window
10` keeps ~10 seconds of `.ts` segments on disk, then deletes them [srs-platform-conf]{1}. This is
*retention / rewind depth*, not playback latency: it caps a live-edge clip's earliest reachable
in-point at ~10s ago, and is not a recording. **DVR** is the correct
substrate: `dvr_plan session` writes one file per broadcast (available on `on_dvr` at stream end);
`dvr_plan segment` finalizes a file every `dvr_duration` (default 30s), enabling mid-stream VOD
clips at a ~segment-duration lag [srs-v6-dvr-doc]{1}.

**Stream-copy vs. transcode.** For H.264+AAC, `-c copy` is fast and lossless [ffmpeg-main-seeking-copy]{1},
but a stream-copied clip can only *start* on a keyframe — the in-point snaps to the preceding
keyframe, so boundary imprecision equals the GOP size [ffmpeg-main-seeking-copy]{2}. FFmpeg's generic
default GOP is 12 frames [ffmpeg-codecs-gop]{1}, but a stream's keyframe interval is set by the
*sender's* encoder (OBS etc.), not the platform — so precision is sender-dependent. Frame-accurate
cuts need a transcode (`-c:v libx264`, `-accurate_seek`) [ffmpeg-main-seeking-copy]{3}. Recommendation:
**stream-copy for the MVP** (accept ≤GOP boundary imprecision), transcode as a later precision option.

**Clip-as-content-item.** A clip is a `type: "video"` content item with a `mediaKey` (clip in Garage),
`thumbnailKey`, `duration` — the existing `processingStatus` lifecycle fits [platform-content-schema]{1}.
What's **new** is more than the extraction fields. The *extraction* link needs `clipSourceType`
(`stream`|`vod`), `clipSourceId`, `clipInOffset`, `clipOutOffset` [platform-content-schema]{2}
(`streamSessions.startedAt` gives the wall-clock→offset anchor for live clips
[platform-content-schema]{3}). But the *product* also needs: a **clipper identity** — the member who
made the clip, which is **not** `content.creatorId` (that FK points at the creator profile being
clipped, not the clipping member) [platform-content-schema]{1}; a **moderation/visibility state**
(published / hidden / removed); a **storage-object key** distinct from clip identity (the dedup
join-point, below); and a defined **source-deletion behavior** (what happens to the clip when its
source VOD is deleted). The "4 fields" is the extraction floor, not the MVP schema.

**Architecture (infra-open).** Lower-risk: on `on_dvr`, upload the DVR file to Garage as a VOD source,
then a pg-boss `clip-extract` job runs FFmpeg over the Garage object — reusing `downloadToTemp →
FFmpeg → uploadFromTemp` exactly [platform-content-schema]{1}. **Two durability caveats:** (a) the
`on_dvr` payload's `file`/`cwd` path is *inside SRS's own filesystem* [srs-v6-dvr-doc]{1}, so the API
reaches it only via a shared volume into the SRS container or an SRS-HTTP fetch; and (b) the callback
is fire-once / best-effort — a missed or failed callback orphans a recording, so a periodic
**reconciliation sweep** (list DVR outputs, ingest any not yet recorded) is the backstop, not
callback-only handoff. Lower-latency (later): a host-level FFmpeg reading the SRS DVR file directly
off the shared volume, skipping the Garage round-trip — at the cost of coupling to host filesystem
layout.

## 2. Viewer-UGC product surface (Q2)

**Permissions** — default **any authenticated member can clip** when the creator has clips enabled,
with a creator **account-level toggle** (on by default) + **per-stream/VOD override**, and an optional
follower/subscriber gate. This matches both incumbents: Twitch gates on a Creator-Dashboard enable +
configurable follower/subscriber restriction [twitch-clips-api-docs]{2}; YouTube is on-by-default with
a per-channel disable + per-user hide list [youtube-clips-help]{2}. The co-op framing adds that a
creator-member's control over derivative clips is a *member right*, so the per-account opt-out is
first-class.

**Attribution** — every clip credits **both** the clipper and the source creator, plus a temporal
anchor back to the source. Incumbents do the same (Twitch returns `creator_name` + `broadcaster_name`
+ `vod_offset` [twitch-clips-api-docs]{3}). Encode via Schema.org `VideoObject` with `isBasedOn`
pointing at the source [schema-org-videoobject]{1}; the CC BY attribution form (creator + link +
modification notice) is the canonical pattern even where streams aren't CC-licensed [cc-by-4-0]{1}.

**The clip page** — a stable short URL (`/clips/{id}`), Open Graph tags (`og:title/type/image/url`
required [ogp-spec]{1}; `og:video:secure_url` HTTPS for inline Feed play [facebook-og-sharing]{1}),
a `summary_large_image` Twitter card as the safe start (thumbnail-only; the inline `twitter:player`
card is a later, distinct build), Schema.org video structured data, and a permissive embed
(`/clips/{id}/embed` with Vidstack). Clip MP4s served from Garage need HTTP Range support
[rfc7233-range-requests]{1} (the same open question tracked from the editor engagement). A thumbnail
is generated async (FFmpeg frame extract) at clip creation.

**Discovery** — per-creator and per-stream clip galleries are near-MVP (a "best moments" surface
falls out organically); a platform-level trending feed is v2 (needs a per-clip view-count signal,
which the data model should carry from day one). YouTube's opt-in "Top community clips" shelf
[youtube-clips-help]{3} is the reference.

**Moderation + DMCA** — **post-moderation** is the right default (pre-moderation kills the
social-sharing value and is disproportionate at launch scale); clips publish immediately with a
reactive member **report** (ActivityStreams `Flag` [activitystreams-vocab]{1}) + creator removal
authority. The platform needs **DMCA safe harbor**, and the statutory pieces sit in different
subsections (precision matters): the **§512(c)** host safe harbor needs a registered designated agent
+ expeditious takedown on valid notice; **counter-notice / restoration is §512(g)**; the
**repeat-infringer termination policy is §512(i)** [dmca-section-512]{1}, [copyright-gov-512]{1}.
Takedown records must distinguish the *source creator*, the *clipper*, and the *claimant* (they can
all differ). The co-op's member-dues (not ad-revenue) model is *plausibly* favorable on the §512(c)
direct-financial-benefit test (no revenue tied to a specific clip) — the synthesis's read, **not
legal advice**.
The **distinctive co-op layer**: moderation decisions affecting creators should be member-accountable
(published policy, an appeals path, transparency reporting) rather than black-box staff calls.

**Storage** — **full-copy** clips (independent of the source-VOD lifecycle, stable URLs) with
**dedup** when many viewers clip the same moment, collapsed to one stored object with multiple clip
records (a `storage_object_key` distinct from clip identity). The reliable dedup key is **near-identical (tolerance-bucketed) in/out offsets on the same
source**, or an output-content hash of the extracted file — overlap alone is not equivalence (a
0–60s clip and a 10–20s clip overlap but differ). **Perceptual hashing** [wikipedia-perceptual-hashing]{1} is a
*secondary / cross-source* signal only: single-frame pHash misses temporal and audio differences and
can false-match visually similar moments, so it is not the primary dedup key for video clips. Garage is self-hosted (cost = infra, not per-GB
fees; PeerTube validates video use on Garage) [garage-overview]{1}; egress on popular clips is the
binding constraint. Retention: no-expiry or orphan-expiry (grace period after source deletion);
engagement-floor cleanup is rejected as member-hostile.

## 3. Riding the existing stack (Q3)

| Layer | Reusable as-is | New |
|---|---|---|
| **SRS** | RTMP→HLS already running | **Enable DVR** + `on_dvr` handling — the prerequisite *for stream-derived* clips (already-uploaded VODs need none) |
| **Garage** | object storage + serving | clip + thumbnail objects; Range support to verify |
| **pg-boss + processing-jobs** | `downloadToTemp/FFmpeg/uploadFromTemp` pattern | a `clip-extract` job type |
| **content schema** | `content` item + `processingStatus` | extraction fields (source link + in/out offsets) **plus** clipper identity (≠ `creatorId`), moderation/visibility state, storage-object key |
| **Vidstack** | clip + embed playback | a clip-page player surface |
| **(none today)** | — | permissions, clip page/OG, discovery galleries, report/moderation, DMCA agent |

## 4. Parity read + MVP vs. full (Q4)

**Parity reference** (Twitch at API-doc level + YouTube help; **Kick UNCONFIRMED**, source 403'd
[clipping-comparators gap]): both incumbents are 5–60s clips, a creator-enable toggle, and clipper
attribution. On creator-delete-of-viewer-clips the warrant differs: YouTube's help documents no
creator-delete (share / play / hide-user / report only) [youtube-clips-help]{4}; Twitch's API docs
document no delete *endpoint*, but the UI-level path is **unconfirmed** (help center inaccessible)
[twitch-clips-api-docs]{4} — absence of documentation, not a documented "cannot." Twitch's
differentiator is the **~85s rolling buffer + instant live create**; YouTube's is **clip-during-live-but-playable-after (DVR) + clip-to-Shorts**.

**MVP (YouTube-style clipping model — segment-select from a recording — with a deliberate co-op divergence):**
0. *Cheapest first slice:* clip an **already-uploaded VOD** (a Garage `content` object) — needs **no DVR**.
1. Then enable SRS DVR + `on_dvr` → Garage (+ the reconciliation sweep) to clip **live-stream** recordings.
2. Clip schema (extraction fields + clipper identity + moderation/visibility state + storage-object key) + a `clip-extract` pg-boss job (FFmpeg stream-copy).
3. Clip creation: in/out selection on a VOD (post-stream), creator + viewer.
4. Clip page (`/clips/{id}`) + OG/`summary_large_image` card + Vidstack + dual attribution.
5. Permissions: any-member-if-enabled, creator account toggle + per-stream override. **Creator-delete-of-viewer-clips is a co-op divergence, not YouTube parity** (YouTube documents hide-user/report, not creator-delete) — included as a deliberate creator-sovereignty choice.
6. Moderation floor: post-moderation, member report, creator delete, designated DMCA agent + takedown procedure.
7. Per-creator / per-stream clip galleries.

**Full (Twitch-shaped + UGC depth, later):**
- Instant **live-edge** clipping — a larger rolling *retention* buffer (closes the 10s→~85s rewind gap) and low creation latency (separate concerns).
- Frame-accurate transcode cuts + `ffprobe` keyframe snapping.
- Platform trending feed; pHash dedup at scale; retention automation.
- `twitter:player` inline card; clip-to-Short style remix; ActivityPub federated clip governance.

## Contradictions

- **Live-create timing models (Twitch vs. YouTube) — design divergence, not contradiction.** Twitch
  creates clips live from a rolling buffer (instant). YouTube lets the viewer start the clip *during*
  live (with DVR) but the clip is only **playable after** the stream ends and uploads as video —
  "create now, playable later," not "cannot create until the VOD exists" [twitch-clips-api-docs]{1},
  [youtube-clips-help]{1}. S/NC picks: YouTube-model for MVP (simpler on a DVR file), Twitch-model for
  full. Surfaced, not smoothed.
- **Full-copy vs. pointer storage (facet-2 internal `tension`).** Full-copy is independent + stable
  but multiplies storage on duplicate moments; dedup by same-source + tolerance-bucketed near-identical
  offsets collapses the common case toward pointer behavior. The sibling editor engagement may choose differently for creator-made clips — a
  design-decision surface, not a resolved claim.
- **Pre-moderation vs. DMCA safe harbor (facet-2 internal).** §512(c) is built for
  publish-then-takedown; the only case for pre-screening is predictably high-risk content (e.g.
  licensed-music streams). Left as a surfaced tension for legal/governance, not resolved here.

## Disconfirming analysis

- **Is the 10s HLS window enough for a live-clip feature?** No — it caps in-points at ≤10s ago and
  evaporates [srs-platform-conf]{1}; DVR is required for anything durable. Disconfirms "HLS alone
  suffices."
- **Is stream-copy always sufficient?** No — non-keyframe in-points yield a slightly-early start or
  corrupted leading frames; sufficient only at keyframe-aligned boundaries or with ≤GOP imprecision
  accepted [ffmpeg-main-seeking-copy]{2}.
- **Does the SRS HTTP API give clip timing?** No — `/api/v1/streams` exposes no timestamps/duration;
  the platform's own `streamSessions.startedAt` is the anchor [srs-v6-http-api-doc]{1},
  [platform-content-schema]{3}. Disconfirms "SRS alone provides timing."

## Open questions (carried)

- **Kick's clip model** — entirely UNCONFIRMED (docs 403'd). The Twitch+YouTube reference is solid
  without it, but the parity table's Kick column is empty.
- **Twitch help-UI specifics** (clip-tab presence, viewer report flow, creator-delete-viewer-clip) —
  help.twitch.tv is JS-rendered and was inaccessible; Twitch is grounded at API level only.
- **Garage Range-request support** — shared with the editor engagement (the `verify-garage-presigned-range-support`
  story); clip-page seeking depends on it.
- **SRS `on_hls` payload + DVR RAW API** — whether the HLS callback carries the segment path, and
  whether DVR can be toggled per-stream at runtime (vs. always-on), both gate the live-edge path.
- **DVR cost/retention** — always-on DVR records every stream; a per-stream/opt-in DVR policy
  interacts with the clip-enable permission.

## Revisit if

- SRS DVR is enabled — *stream-derived* clipping becomes buildable (the already-uploaded-VOD slice
  doesn't wait on it); re-confirm the `on_dvr` payload + plan choice (session vs. segment) against
  the live-edge rewind-depth target.
- Garage Range support is confirmed/denied — affects clip-page playback + seeking.
- Kick / Twitch-UI sources become reachable — fill the parity table gaps.
- The platform adopts ActivityPub — federated clip attribution (`attributedTo`) + `Flag`/`Delete`
  moderation become the cross-server primitives.
