---
title: "Adversarial verification — stream-clipping-twitch-parity parent synthesis"
campaign: stream-clipping-twitch-parity
stage: adversarial-read
provenance: agent-synthesis
verifier: adversarial-read
target: parent.md
updated: 2026-06-24
---

# Adversarial verification checklist — parent.md

Fresh-context skeptical pass over `parent.md`, cross-walking every load-bearing citation to its
attestation, with full access to the three specialist briefs and all 28 attestations. Lint output
(19 resolved, 19 `unreachable-source`/low URL-liveness only, no unresolved/colliding) confirmed —
this pass is the semantic layer the lint cannot reach.

## Priority-focus findings (where over-claim is most likely)

**P1 — DVR prerequisite headline. CLEAN.** Parent Headline-1 "no persistent recording today —
`srs.conf` enables no DVR" → `[srs-platform-conf]{1}` is exactly attested ("DVR is **not
configured**… no DVR file is written, no `on_dvr` callback fires"). "YouTube confirms DVR is the
substrate: 'you can't create Clips from live streams without DVR'" → `[youtube-clips-help]{1}` is a
verbatim quote present in the attestation. NOT over-read.

**P2 — ~85s vs 10s parity gap. CLEAN, not conflated.** "~85-second rolling buffer"
→ `[twitch-clips-api-docs]{1}` matches the attestation ("about 85 seconds of the stream before the
call"). The "10 seconds" is consistently tied to `[srs-platform-conf]{1}` (`hls_window 10`). The two
figures are kept on their correct sources throughout (Headline-2, §1, §4). The parent's "~85s/90s"
framing is faithful: 90s total capture window, ~85s before the call — both in the attestation.

**P3 — design-inference preservation. MOSTLY CLEAN, one boundary issue (see job-b #1).** The
parent correctly does NOT present the storage MB figures, retention policy, permissions defaults,
clip-length limits, or co-op governance as source-attested. §2 attaches citations only to the
genuinely-sourced spine (Twitch/YT permission *existence*, Schema.org/CC-BY attribution form, OGP
tags, DMCA elements, pHash, ActivityStreams Flag) and leaves the S/NC design choices uncited or
flagged "*not legal advice*"/"design-decision surface." The facet-2 discipline survived the lift.
The one soft spot: see job-b #1 (Twitch creator-delete).

**P4 — comparator gaps honestly flagged. CLEAN.** Kick is marked UNCONFIRMED at every appearance
(Headline-implicit, §4 parity reference "**Kick UNCONFIRMED**, source 403'd", Open-questions). No
Kick feature claim is filled from recall. Twitch help-UI inaccessibility is flagged in §4 ("at
API-doc level") and Open-questions. No training-recall leak detected.

**P5 — §6 composed-claim / 11–22 MB. CLEAN.** The parent does NOT import the "11–22 MB/clip"
bitrate arithmetic that facet-2 explicitly flagged "not source-attested." The parent's storage
discussion (§2 Storage) speaks only to cost-model qualitative claims ("cost = infra, not per-GB
fees" → `[garage-overview]{1}`, attested) and the pHash-dedup mechanism. No effort estimates, no
numeric superlatives carried into the parent.

---

## Job catalog (a–h)

### (a) Semantic citation-chain walk — load-bearing claims
Walked every `[handle]{N}` in parent.md to its attestation. All semantically support the claim as
stated, with two exceptions noted in (b) and (c). Spot confirmations:
- `[ffmpeg-main-seeking-copy]{1,2,3}` — stream-copy lossless/fast {1}, in-point snaps to preceding
  keyframe {2}, transcode for frame-accurate {3}: all three map to distinct attested passages
  (`-c copy` "no quality loss"; preserved extra-segment on input-side `-ss`+copy; `-accurate_seek`
  decode-and-discard with transcode). Sub-index discipline is correct.
- `[ffmpeg-codecs-gop]{1}` — "generic default GOP is 12 frames": attested exactly ("Default value
  is 12"). Parent correctly frames it as the *generic* default and immediately qualifies that the
  real keyframe interval is sender-set — matching the attestation's own caveat that libx264's
  keyint is unconfirmed. No over-read.
- `[platform-content-schema]{1,2,3}` — clip-as-content-item {1}, processing pipeline reuse {2},
  `streamSessions.startedAt` anchor {3}: all attested. The "4 clip fields" addition is presented as
  a *new* requirement (not as source-attested existing schema), matching the attestation's "No
  existing field links a clip… that would need a new column."
- `[twitch-clips-api-docs]{2,3}` (permissions), `{3}` (attribution fields): attested
  (`clips:edit`, three-condition gate, `creator_name`+`broadcaster_name`+`vod_offset`).
- `[schema-org-videoobject]{1}` (`isBasedOn`) — attested via CreativeWork inheritance.
- `[dmca-section-512]{1}` + `[copyright-gov-512]{1}` (§512(c) elements) — designated agent,
  expeditious takedown, counter-notice, repeat-infringer: all attested across the two handles.
- `[activitystreams-vocab]{1}` (`Flag`) — attested verbatim.
- `[wikipedia-perceptual-hashing]{1}` (dedup) — attested.
- `[garage-overview]{1}` (self-hosted, PeerTube validates video use) — attested.
- `[ogp-spec]{1}` (4 required OG tags) + `[facebook-og-sharing]{1}` (`og:video:secure_url` HTTPS
  for inline Feed) — both attested.
- `[rfc7233-range-requests]{1}` (Range support for clip MP4 seeking) — attested.
- `[srs-v6-dvr-doc]{1}` (session=one-file/end, segment=`dvr_duration` default 30s) — attested.
- `[srs-v6-http-api-doc]{1}` (no timestamps/duration on `/api/v1/streams`) — attested.

### (b) Claim-shapes the lint missed
**#1 — Twitch creator-delete: cite-through over-extended into a positive claim. [MINOR]**
Parent §4: *"neither lets the creator **delete** viewer clips per the fetched docs
`[twitch-clips-api-docs]{4}`, `[youtube-clips-help]{4}`."* For **YouTube** this is supported (help
page lists share/play/hide-user/report, not delete — attested). For **Twitch** the comparator brief
is explicitly more careful: creator-delete-of-viewer-clips is a **GAP** — *"unconfirmed from a
fetched primary source… The API documentation does not document a delete endpoint"* — which is
absence-of-documentation, NOT a documented "creator cannot delete." The parent's "neither lets…"
reads the Twitch silence as a confirmed negative. The attestation `[twitch-clips-api-docs]` says
only "The documentation page does not describe a clip deletion API endpoint." Recommend softening to
"YouTube's help page lists no creator-delete of viewer clips; Twitch's API docs document no delete
endpoint (UI-level deletion unconfirmed — help center inaccessible)."

**#2 — "both incumbents are 5–60s clips" (§4 parity reference). CLEAN.** Verified: Twitch editor
range 5–60s `[twitch-clips-api-docs]{7}`, YouTube 5–60s `[youtube-clips-help]{3,4}`. Both attested.
Not a composed superlative — it is a documented coincidence the comparator brief explicitly checked.

No other uncited plausible-attribution or comparative-as-description shapes found in the parent.

### (c) Coherence-read for smoothed contradictions
The parent handles the Twitch-live vs YouTube-DVR divergence correctly — surfaced under
`## Contradictions` as "design divergence, not contradiction," named side-by-side with both
citations, no resolution-by-paraphrase. The full-copy vs pointer and pre-moderation vs safe-harbor
tensions are likewise carried forward as surfaced (not collapsed). **One residual smoothing:** the
job-b #1 Twitch-delete claim merges a YouTube *documented* absence with a Twitch *undocumented*
state under one "neither lets" paraphrase — a mild same-term-different-warrant merge. Same target as
job-b #1.

### (d) Noise-domination / relevance-weighting
Read all attestations for each major claim. **No misweighted citations found.** Where multiple
handles could support a claim, the parent cites the most relevant: DVR substrate → SRS conf + SRS
DVR doc (not the weaker HLS doc alone); attribution form → CC-BY + Schema.org (the two that actually
carry the compositional logic). The `[srs-v6-hls-doc]{1}` co-citation on Headline-1 (HLS window
"evaporates") is apt — it is the doc that establishes the rolling-window-not-recording behavior, and
the platform-conf handle carries the concrete `hls_window 10`. Correct division of labor, not noise.

### (e) Quote-context walk
Verbatim quotes in the parent: the YouTube "you can't create Clips from live streams without DVR"
quote `[youtube-clips-help]{1}` is reproduced faithfully and does NOT strip the source's companion
qualifier ("or live streams longer than the DVR timeframe") in a way that changes meaning — the
parent's surrounding prose ("No DVR → no clips that outlive a 10-second window") is consistent with
the full quote. No qualifier-stripping detected.

### (f) Analytical-tier-inheritance walk
The seed names `video-editing-tools.md` as LENS (partial-replaces, never a citation target). The
parent makes no `[handle]{N}` citation to that prior brief, and its "companion to the
editor-integration engagement" / "sibling editor engagement" mentions are framing-only (no claim is
sourced *to* the sibling). The `verify-garage-presigned-range-support` story reference is a `.work/`
pointer, not a source citation. **No lens-as-substrate violation.** The parent's design judgments
(MVP/full split, recommendation to stream-copy for MVP) are presented as synthesis reasoning, not as
source-attested — correct tier discipline.

### (g) Line-reference walk
No parent citation targets a specific line/section range of a source beyond the sub-index `{N}`
convention. Sub-indexed cites (`[ffmpeg-main-seeking-copy]{1/2/3}`,
`[platform-content-schema]{1/2/3}`, `[twitch-clips-api-docs]{1/2/3/4}`) each derive from a distinct
attested passage in the corresponding attestation — verified per (a). No range-derivation error.

### (h) Thin-attestation check (semantic) — the 9 reduced-substrate flags
The lint flagged 9 `reduced-substrate-attestation` [info] on the reused SRS handles
(`srs-v6-hls-doc`, `srs-v6-dvr-doc`, `srs-v6-http-callback-doc`, `srs-fullconf-source`). Semantic
assessment of whether the short bodies support the parent's SRS claims:
- `srs-v6-dvr-doc` — carries `dvr_plan session`/`segment`, `dvr_duration 30` default, `on_dvr` fires
  on file reap with `file`+`cwd` payload. The parent's §1/§4 DVR claims (one-file-per-broadcast on
  session, ~segment-duration lag on segment, `on_dvr` at stream end) are **substantively supported**.
  Several `[unverified-exact]` markers on the passages, but the structural claims the parent makes
  are the paraphrased-summary content, not the exact-wording-dependent parts. OK.
- `srs-v6-hls-doc` — supports the "10s window evaporates / not a recording / SRS has no LL-HLS"
  claims. The parent's `[srs-v6-hls-doc]{1}` on Headline-1 leans on the rolling-window behavior,
  which the body carries. OK.
- `srs-v6-http-callback-doc` — the parent does not actually cite this handle in `parent.md` (it
  appears in the specialist's `research_handles` and the disconfirming-analysis of the specialist,
  not parent body). No parent claim rests on it. No issue at parent tier.
- `srs-fullconf-source` — not cited in `parent.md` body either (specialist-only). No parent claim
  rests on it.
**Verdict on (h):** the two SRS handles the parent *does* cite (`-dvr-doc`, `-hls-doc`,
`-http-api-doc`) substantively support their parent claims despite short bodies. The thin flag is an
artifact of multi-deployment reuse of pre-existing attestations, not a per-claim support failure at
the parent tier. No thin-attestation violation.

---

## Summary of findings
- **1 MINOR claim-shape issue** (job-b #1 / job-c): the Twitch half of "neither lets the creator
  delete viewer clips" over-reads documentation-silence as a confirmed negative. The comparator
  brief treats it as a gap; the parent should too.
- All 5 priority-focus risks: **CLEAN** (the highest-risk one, P3 design-inference preservation, held).
- Jobs (d), (e), (f), (g), (h): nothing surfaced.

The single issue is a one-clause precision fix, not a fabrication and not a structural defect. It
does not undermine any build recommendation. On balance the synthesis is well-disciplined: gaps are
flagged, design inferences are not dressed as sourced, the composed MB figure was correctly left
out, and contradictions are surfaced rather than smoothed.

VERDICT: NEEDS-REVISION

### Revision targets (specific)
1. **parent.md §4, "Parity read + MVP vs. full" paragraph** — the clause *"neither lets the creator
   delete viewer clips per the fetched docs `[twitch-clips-api-docs]{4}`, `[youtube-clips-help]{4}`."*
   Split the warrant: YouTube's help page documents no creator-delete of viewer clips
   (`[youtube-clips-help]{4}`, supported); Twitch's **API** docs document no delete endpoint but
   UI-level creator deletion is **unconfirmed** (help center inaccessible) — do not assert "Twitch
   does not let." Suggested: *"YouTube's help page lists no creator-delete of viewer clips
   `[youtube-clips-help]{4}`; Twitch documents no delete endpoint in the API and the UI-level
   delete-viewer-clip path is unconfirmed (help center inaccessible) `[twitch-clips-api-docs]{4}`."*
   Mirror the same softening anywhere the "neither/both" framing repeats this as a flat parity claim.

(After this one-clause fix the synthesis clears adversarial-read. No other targets.)
