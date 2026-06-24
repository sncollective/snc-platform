---
title: "Viewer-UGC Product — Clip Surface Design"
campaign: stream-clipping-twitch-parity
facet: viewer-ugc-product
provenance: agent-synthesis
updated: 2026-06-24
specialists: [viewer-ugc-product]
---

# Viewer-UGC Product: Clip Surface Design

**Scope:** Product and design surface for viewer-generated clips on the S/NC platform — permissions, attribution, clip page (OG/sharing), discovery, moderation, and storage/retention. Interpreted through the co-op lens (member rights, creator control, governance).

---

## 1. Permissions Model

### 1.1 Who Can Clip

*Design inference, not source-attested:* A logged-in viewer / platform member should be the minimum gate for clip creation. Unauthenticated users are inappropriate as clippers because attribution requires an identity anchor — a clip with no associated member account can't be credited, governed, or held accountable. Platform membership in the S/NC co-op context carries additional weight: members have accepted terms and have a governance stake, making them meaningfully distinct from anonymous viewers.

Follower-only clipping (as an additional gate beyond login) is a plausible restriction but adds friction — if the creator already controls clip enable/disable per stream, the follower gate is less necessary. Inference: implement **any authenticated member can clip** as the default; give creators the opt-in follower gate as an optional tightening.

### 1.2 Creator Control: Per-Creator and Per-Stream Clip Enable/Disable

This is the central permission axis. Competitor platforms (lens, not attested here) use a flag to let streamers disable clipping entirely. The S/NC co-op governance angle adds a second frame: **the stream content belongs to the creator-member**; their control over derivative clips is a member right, not a platform affordance.

*Design inference:* Two control levels are needed:

1. **Account-level default** — a creator's settings should have a global "allow viewer clips" toggle (on by default for new accounts). This default can be adjusted in stream settings.
2. **Per-stream/VOD override** — on each stream or VOD, a "clips enabled" flag (inheriting the account default, overridable per item). This lets a creator lock a specific stream (e.g., a private workshop recording archived later) while leaving public streams clippable.

The account-level toggle means a creator can permanently opt out with a single action — relevant for co-op governance: members who don't want their content clipped at all have a clear path.

### 1.3 Clip Length Limits

*Design inference:* A reasonable default range is 5–60 seconds for viewer-created clips. The lower bound prevents trivially short clips that lose context; the upper bound controls storage and keeps clips meaningfully shorter than the source. A 60-second ceiling is a judgment call consistent with the "highlight" use case — not sourced from a primary document. The creator could be given the ability to extend the allowed maximum to 120 seconds for their own streams (inference: this is a creator-in-control co-op feature).

---

## 2. Attribution

### 2.1 The Attribution Requirement

Attribution is a documented norm for content that is a derivative of another work. The CC BY 4.0 license illustrates the canonical form: attribution must include the creator name, copyright notice, a link to the material, and indication that modifications were made [cc-by-4-0]{1}. While S/NC streams are not necessarily CC-licensed, this establishes the compositional logic: a clip is a derivative work of the stream, and the stream's creator deserves attribution.

*Design inference:* Each clip must display:
- **Clipper credit:** the member who created the clip (name/handle, link to their profile)
- **Source credit:** the stream creator (name/handle, link to their channel/stream) and the source VOD/stream title
- **Temporal anchor:** the timestamp in the source stream where the clip originates

The clip is a pointer to the source, not a replacement. The source link must be preserved even if the VOD is later deleted — at minimum as a broken-but-honest reference rather than silently severed attribution.

### 2.2 Schema.org Encoding of Attribution

For structured data purposes, Schema.org's VideoObject supports both `creator` and `author` (inherited from CreativeWork) for attribution [schema-org-videoobject]{2}. A clip page's JSON-LD should carry:

```json
{
  "@type": "VideoObject",
  "name": "Clip: [clip title]",
  "creator": { "@type": "Person", "name": "[clipper handle]" },
  "isBasedOn": { "@type": "VideoObject", "name": "[stream title]", "url": "[source VOD URL]" },
  "author": { "@type": "Person", "name": "[stream creator handle]" }
}
```

The `isBasedOn` property (inherited from CreativeWork) is the correct relation between a clip and its source, semantically distinct from authorship.

---

## 3. The Clip's Own Page

### 3.1 Shareable URL

Each clip needs a permanent, shareable URL. *Design inference:* a clean path structure like `/clips/{clip-id}` or `/c/{clip-id}` — short enough for social sharing, not tied to creator or stream slug (which can change). The clip ID should be a short opaque identifier (not sequential integers, to prevent enumeration).

### 3.2 Open Graph Tags for Social Sharing

The Open Graph Protocol specifies four required properties for any OGP page [ogp-spec]{3}: `og:title`, `og:type`, `og:image`, and `og:url`. For a video clip:

- `og:type` should be `video.other` (the most appropriate OGP video type for short user-generated clips that are not a movie or episode)
- `og:title` — the clip title (e.g., "Amazing goal clip — [Stream Title]")
- `og:url` — the canonical clip URL
- `og:image` — a thumbnail image representing the clip (the preview frame)
- `og:description` — clip description or auto-generated from stream context

For inline video play in the Facebook Feed, the `og:video:secure_url` tag is required — it must be HTTPS [facebook-og-sharing]{4}. Additional video tags:

```html
<meta property="og:video" content="https://...clip.mp4" />
<meta property="og:video:secure_url" content="https://...clip.mp4" />
<meta property="og:video:type" content="video/mp4" />
<meta property="og:video:width" content="1280" />
<meta property="og:video:height" content="720" />
<meta property="og:image" content="https://...clip-thumb.jpg" />
<meta property="og:image:width" content="1280" />
<meta property="og:image:height" content="720" />
```

Image/thumbnail dimensions should be at least 600px wide; 1080px+ recommended for high-DPI displays [facebook-og-sharing]{4}.

### 3.3 Twitter/X Cards

The Twitter/X Card endpoint at `developer.x.com` was inaccessible (402) during this engagement (blocking acquisition candidate below). From training-data lens (not cited as source): two applicable card types — `summary_large_image` (thumbnail only, simpler) and the `twitter:player` card (inline video play). The player card requires an HTTPS iframe player URL.

*Design inference:* `summary_large_image` is the safer implementation starting point because it requires only a thumbnail — no separate player iframe endpoint. If inline playback in tweets is a goal, a `twitter:player` card requires a dedicated HTTPS player embed endpoint, which is a buildable but distinct feature.

Minimum Twitter card tags for a clip page:
```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="[clip title]" />
<meta name="twitter:description" content="[clip description]" />
<meta name="twitter:image" content="https://...clip-thumb.jpg" />
```

### 3.4 Schema.org Structured Data

Google Search's video structured data requires three fields for rich results: `name`, `thumbnailUrl`, and `uploadDate` (ISO 8601) [google-structured-data-video]{5}. Recommended additions: `contentUrl`, `description`, `duration` (ISO 8601 format, e.g., `PT30S`). The Clip type in Google structured data adds `startOffset`, `endOffset`, and `url` — which are relevant for key moments markup on the source VOD page (linking to the clip's timestamp), not for the clip's own page [google-structured-data-video]{5}.

A complete JSON-LD block for a clip page:

```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "[clip title]",
  "description": "[clip description]",
  "thumbnailUrl": "https://...clip-thumb.jpg",
  "uploadDate": "2026-06-24T00:00:00Z",
  "duration": "PT30S",
  "contentUrl": "https://...clip.mp4",
  "embedUrl": "https://platform.snc.coop/clips/[id]/embed"
}
```

### 3.5 Embedding

A clip embed URL (`/clips/{id}/embed`) should serve a minimal HTML page with the Vidstack player loading the clip's MP4. For embedding in third-party sites, `X-Frame-Options: ALLOWALL` or a permissive `Content-Security-Policy: frame-ancestors *` is required — *design inference:* embedding is a social sharing goal, so open embeds are the appropriate posture.

The clip MP4 served from Garage S3 needs to support HTTP Range requests [rfc7233-range-requests]{6} — Garage implements the S3 API and standard HTTP object serving, so this is a function of ensuring the S3 serving path passes `Accept-Ranges: bytes` and `Content-Range` correctly, which S3-compatible stores do by default.

### 3.6 Thumbnail Generation

Thumbnails are required for OG image, schema.org `thumbnailUrl`, and general UX. *Design inference:* FFmpeg's `-vf thumbnail -frames:v 1` filter [ffmpeg-clip-options]{7} selects a representative frame. Generation should happen async (e.g., via pg-boss job) at clip creation time: extract one frame from the clip's midpoint, store as JPEG/WebP in Garage, record the URL.

---

## 4. Discovery

### 4.1 Per-Creator Clip Gallery

*Design inference:* Each creator's channel page should include a "Clips" tab listing clips viewers made of their content, ordered by recency or engagement (view count, share count). This is a member-visible gallery that the creator can manage (delete their clips from this view even if they didn't create them — creator sovereignty over their own content).

### 4.2 Per-Stream Clip Gallery

Each VOD/stream archive page should show clips generated from that stream, ordered by timestamp in the source or by popularity. This creates a "best moments" feature organically.

### 4.3 Platform-Level Clip Feed / Trending

A sitewide clips feed ("Top Clips") ordered by recent or trending (view count within a time window) is a common discovery surface. *Design inference:* This is a v2 feature — requires engagement signal tracking (views per clip). The data model should support it from day one (view count column on the clip record) even if the surface isn't shipped immediately.

### 4.4 Search / Tag Integration

Clips inherit the stream's tags. Search should be able to surface clips alongside VODs and streams in results. *Design inference:* no additional schema needed beyond the clip's relation to the parent stream (which carries the tags).

---

## 5. Moderation of Viewer-Generated Clips

### 5.1 The Pre- vs Post-Moderation Choice

Documented moderation patterns distinguish three windows: pre-moderation (before content is live), proactive post-moderation (scanning after going live), and reactive post-moderation (user reports) [wikipedia-trust-safety]{8}. Platforms use "a combination of algorithmic tools, user reporting and human review" [wikipedia-content-moderation]{9}.

*Design inference for S/NC:* Pre-moderation (holding every clip in a queue before publishing) is disproportionate overhead for a co-op at launch scale, and creates latency that destroys the social-sharing value proposition (clips go stale fast). The appropriate starting posture is **post-moderation**: clips publish immediately, with a reactive report mechanism plus creator-control tools.

This matches the documented "combination" pattern — reactive reports (user moderation: "the votes of the rest of the community" [wikipedia-content-moderation]{9}) plus creator removal authority.

### 5.2 Creator Controls Over Clips of Their Content

Creator sovereignty over derivative clips is the co-op governance angle that distinguishes S/NC from an ad-driven platform:

- **Creator can delete any clip** made from their stream — no appeal required
- **Creator can disable clipping** per-stream retroactively (stops new clips; does not auto-delete existing ones, but should prompt the creator whether to delete existing clips too)
- **Creator can hide a clip from their gallery** without deleting it

These are not source-attested from a competitor policy — they are design inferences from the principle that creator-members control their content.

### 5.3 Member Report/Flag Mechanism

Any authenticated member should be able to flag a clip as inappropriate. The ActivityStreams vocabulary defines a `Flag` activity type for precisely this: "reporting content as being inappropriate for any number of reasons" [activitystreams-vocab]{10}. This is the vocabulary-level primitive; the platform implementation maps it to a report queue.

*Design inference:* Flag reasons should be a fixed enumeration (not free-text at submission, to reduce moderation burden): `copyright_claim`, `harassment`, `explicit_content`, `spam`, `other`. The `other` category should allow a short text field.

### 5.4 Takedown and DMCA Compliance

Clips of live streams carry copyright risk if the stream contained third-party music or content. The platform needs DMCA §512(c) safe harbor to avoid liability for user-uploaded clips [dmca-section-512]{11}, [copyright-gov-512]{12}.

Required §512(c) compliance elements:
1. Designated DMCA agent registered with the Copyright Office [copyright-gov-512]{12}
2. Published takedown notice procedure (public-facing contact info)
3. Expeditious takedown upon valid notice [copyright-gov-512]{12}
4. Counter-notice and reinstatement procedure (10–14 business days) [dmca-section-512]{11}
5. Repeat infringer policy (account suspension for repeat offenders) [dmca-section-512]{11}

The financial benefit test [dmca-section-512]{11} matters for S/NC: as a co-op with member dues rather than ad revenue, the platform does not directly benefit financially from any specific infringing clip. This is a favorable fact pattern for safe harbor, but is not a legal opinion.

### 5.5 The Co-op Governance Angle

*Design inference:* The distinction from a commercial platform is that clip moderation decisions affecting creators should be transparent and accountable to the membership. Options:

- A published moderation policy ratified by members (not just set by platform staff)
- An appeals path that goes to a member-elected moderation committee rather than a black-box staff decision
- Transparency reports (number of clips removed, reason categories) — governance artifact, not a UX feature

This is not attested from a documented co-op model specific to streaming — it is a synthesis inference from the co-op principle that governance decisions are member-accountable.

### 5.6 Perceptual Hashing for Repeat-Content Detection

Perceptual hashing [wikipedia-perceptual-hashing]{13} is used by major platforms (Google Image Search, Meta) for near-duplicate detection and copyright enforcement. For S/NC, the application is twofold:
1. **Deduplication:** Multiple viewers clipping the same 30-second moment produce perceptually identical clips — phashing can detect these and either deduplicate at storage or link them as "same moment" aliases.
2. **CSAM/known-bad content detection:** Integration with hash databases (PhotoDNA) is a Trust & Safety baseline for any video platform.

*Design inference:* pHash deduplication at clip creation time is worth implementing: compute the hash, check against existing clips from the same source stream in the same time window. If a match is found, link the new clip request to the existing clip as a "clip also made by" relationship rather than storing a second copy.

---

## 6. Storage Cost and Retention Posture

### 6.1 What a Clip Costs to Store

*Design inference, not source-attested:* A 30-second clip at 1080p30 H.264 (typical stream output bitrate 3–6 Mbps) is approximately 11–22 MB per clip. At 60 seconds maximum length: 22–44 MB. These are rough figures not cited from a source — they are bitrate arithmetic, not source claims.

Garage S3 is self-hosted [garage-overview]{14}, so cost is infrastructure (disk + power + bandwidth) rather than per-GB fees. PeerTube (documented Garage-compatible application [garage-overview]{14}) represents evidence that video platform use cases are validated on Garage. The cost model is: disk is cheap; bandwidth/egress is the binding constraint, especially for popular clips that get widely shared.

### 6.2 Two Storage Approaches for Clips

**Full-copy approach:** FFmpeg extracts the clip segment and stores it as a standalone MP4 in Garage S3. Clean, portable, independently servable. Cost: one MP4 per clip.

**Pointer/time-range approach:** Clips store only `{source_vod_id, start_offset_seconds, end_offset_seconds}` and are served dynamically via HTTP range requests against the source VOD file. Cost: near-zero additional storage; serving cost only. Risk: if the source VOD is deleted, clips break.

*Design inference:* The full-copy approach is the right posture for clips because:
- It makes clips independent of the source VOD lifecycle (creator deletes the VOD; clip survives or is explicitly cleaned up by policy decision)
- It's the standard approach for shareable content (clips need a stable URL with a stable resource behind it)
- At the anticipated S/NC scale (not YouTube), the per-clip storage cost is manageable

### 6.3 Deduplication via Perceptual Hashing

When multiple viewers clip the same moment, the full-copy approach without dedup stores N near-identical files. The perceptual hashing approach [wikipedia-perceptual-hashing]{13} identifies these at creation time: if clip A and clip B from the same source VOD have the same perceptual hash, store one file and record both "clip" records pointing at the same object key.

*Design inference:* This is a meaningful optimization at scale. The data model should have a `storage_object_key` column on the clip record, separate from the clip's identity — two clip records can share one storage object.

### 6.4 Retention Policy

*Design inference:* A blanket "clips never expire" policy creates unbounded storage growth. Options:

1. **No expiry (default):** Clips persist indefinitely unless deleted by creator/clipper/moderation. Simple, predictable for members.
2. **Orphan expiry:** Clips from a VOD that has been deleted by the creator expire after a grace period (e.g., 30 days), unless the clipper has explicitly "saved" the clip.
3. **Engagement floor:** Clips with zero views after N months are eligible for cleanup. Aggressive, controversial from member rights perspective.

The co-op governance angle argues for option 1 or option 2 (with transparency), not option 3 (which removes member-created content without consent).

---

## Disconfirming Analysis

**On post-moderation as the right default:** The DMCA "red flag" test [dmca-section-512]{11} holds that a platform loses safe harbor if it has "awareness of facts or circumstances from which infringing activity is apparent" and fails to act. A platform that publishes clips with no pre-screen is technically post-moderation and relies entirely on the reactive notice-and-takedown mechanism. This is the documented §512(c) pattern — YouTube operates on this model. The disconfirming case is that if S/NC's content contains predictably high-risk material (e.g., licensed music streams where copyright is a known issue), a more proactive scan before publication could be warranted. This facet does not resolve the tension — it surfaces it.

**On full-copy storage vs pointer:** The pointer approach is more storage-efficient and avoids duplicate data. The disconfirming case for full-copy is: if 500 people clip the same 30-second moment, full-copy stores 500 MP4s (10+ GB for that moment); pointer stores 1 MP4 plus 500 records. Dedup via perceptual hashing [wikipedia-perceptual-hashing]{13} bridges these — full-copy storage with dedup collapses to pointer behavior in the common case.

**On any-member clipping vs follower-only:** The more open permission (any member) increases volume of clips and storage cost. The disconfirming case: a creator who has a small, trusted follower base may feel violated when random members clip their stream. The co-op governance argument goes both ways — member autonomy includes the viewer's right to clip (if they're paying members) as well as the creator's right to restrict it.

---

## Contradictions

**Pre-moderation vs DMCA safe harbor:** The Wikipedia UGC article defines derivative content that simply copies portions of existing content (e.g., clipping a stream) as not meeting the OECD UGC definition [wikipedia-ugc]{15}. This creates a definitional tension with DMCA §512(c) [dmca-section-512]{11} safe harbor, which is designed for exactly this kind of user-directed storage — the DMCA safe harbor applies to the platform hosting the clip, regardless of whether the clip itself qualifies as "UGC" by OECD definition. These frameworks use the same term for different purposes; both are relevant but non-contradictory at the platform design level.

**Full-copy vs pointer for VOD lifetime:** If the platform's stream clipping feature (sibling facet) uses a pointer/time-range model for creator-made clips, but viewer clips use full-copy, the system has two different clip storage architectures. This is not a contradiction requiring resolution here — it is a design decision surface the implementation facet should address.

---

## Revisit If

- The Twitter/X player card specification becomes accessible — the `twitter:player` card requirements for inline video play in posts were not obtainable from `developer.x.com` (402 response). If inline video playback in X/Twitter posts becomes a priority, this is a blocking gap.
- S/NC's Garage deployment has specific egress bandwidth constraints that change the cost calculus for full-copy storage of clips.
- The platform adds ActivityPub federation (Owncast has it [owncast-github]{16}) — at that point the `Flag` activity [activitystreams-vocab]{10} and `Delete` activity [activitypub-spec]{17} become the federated moderation primitives, and this facet needs an extension for cross-server clip governance.
- The co-op membership policy defines whether all authenticated users are "members" or whether a distincion between member and guest viewer applies — the permissions model depends on this.
- Legal counsel reviews the DMCA §512(c) analysis — none of the analysis above constitutes legal advice.

---

## Footnotes

1. [cc-by-4-0]: Creative Commons BY 4.0 license — attribution requirements. Fetched: https://creativecommons.org/licenses/by/4.0/ on 2026-06-24.
2. [schema-org-videoobject]: Schema.org VideoObject — `creator`, `author`, `isBasedOn` properties via CreativeWork inheritance.
3. [ogp-spec]: Open Graph Protocol — required properties and video structured properties.
4. [facebook-og-sharing]: Facebook/Meta developer documentation — OG video sharing, `og:video:secure_url` requirement for inline Feed play.
5. [google-structured-data-video]: Google Search video structured data — required fields and Clip type for key moments.
6. [rfc7233-range-requests]: RFC 7233 — HTTP range requests enabling video seeking.
7. [ffmpeg-clip-options]: FFmpeg documentation — `-ss`, `-t`, `-to`, `-c copy`, thumbnail filter.
8. [wikipedia-trust-safety]: Wikipedia Trust and Safety — pre/proactive/reactive moderation three-window model.
9. [wikipedia-content-moderation]: Wikipedia Content Moderation — automated + user + human review combination; supervisor vs user moderation.
10. [activitystreams-vocab]: W3C ActivityStreams 2.0 Vocabulary — Flag activity type for content reporting.
11. [dmca-section-512]: Wikipedia OCILLA — §512(c) requirements, knowledge standard, repeat infringer policy.
12. [copyright-gov-512]: US Copyright Office §512 study — designated agent, expeditious takedown, counter-notice.
13. [wikipedia-perceptual-hashing]: Wikipedia Perceptual Hashing — near-duplicate detection algorithms, platform usage.
14. [garage-overview]: Garage S3 overview — self-hosted S3, PeerTube compatibility, media storage use case.
15. [wikipedia-ugc]: Wikipedia User-Generated Content — OECD definition, DMCA safe harbor, derivative content.
16. [owncast-github]: Owncast GitHub — self-hosted streaming feature set; absence of clipping documented.
17. [activitypub-spec]: W3C ActivityPub — Delete and Block activities; attribution via `attributedTo`.
