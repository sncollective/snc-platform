---
provenance: agent-synthesis
updated: 2026-06-16
campaign: liquidsoap-version-capability-audit
facet: backlog-feasibility-map
---

# Backlog feasibility map — streaming items vs Liquidsoap/SRS capability surface

This facet maps the streaming backlog against the Liquidsoap/SRS capability surface, marking which
items a newer-version (or already-present) capability makes newly-feasible or reshapes. It runs in
**parallel** with the LS/SRS capability facets, so every feasibility read here is **conditional**
on a named capability that another facet verifies. The lead reconciles this map against the
verified facet findings.

**How to read each row's feasibility:** `newly-feasible` / `shape-changed` / `unaffected` /
`still-blocked` are *conditional verdicts* — true IF the keyed capability holds as the changelog
entry suggests `[liquidsoap-changes-main]{1}`. Capability keys point at the facet that verifies
them: `ls-version-delta`, `ls-2.5.0-capabilities`, `srs-ffmpeg-seam`, plus the already-settled
`editorial-engine` spike position (lens, not re-verified here).

## Capability surface (named, version-keyed, pending facet verification)

From the Liquidsoap changelog `[liquidsoap-changes-main]{1}` (production runs **2.4.2**):

- **`source.dynamic`** — experiment flag removed in **2.3.0**; non-experimental in production
  2.4.2. Swaps a source's child live; child need not exist at parse time. (Settled mechanism per
  the editorial-engine spike position — lens.) *Confirm semantics: facet `ls-version-delta`.*
- **ref-driven `switch()` time/state predicates** — `switch()` re-evaluates predicate getters
  against the clock; long-standing idiom, no versioned feature add observed. Settled live by the
  editorial-engine spike. *Confirm idiom: facet `ls-version-delta` / `ls-2.5.0-capabilities`.*
- **cron thread (`cron.parse`, `cron.{add,remove}`)** — added **2.4.0** `[liquidsoap-changes-main]{2}`;
  present in production 2.4.2. A native scheduled-task primitive. *Confirm: facet `ls-version-delta`.*
- **`request.queue.remove` / `remove_request_id`** — added **2.4.5** `[liquidsoap-changes-main]{3}`;
  **NOT in production 2.4.2** — an upgrade target. *Confirm: facet `ls-version-delta`.*
- **subtitles content-type** (`%subtitle`, `on_subtitle`, `subtitles.map`, `subtitles.insert`,
  SRT decode) — added **2.5.0 (unreleased)** `[liquidsoap-changes-main]{4}`; **NOT in production
  2.4.2, not yet a stable release.** *Confirm scope + status: facet `ls-2.5.0-capabilities`.*
- **`output.hls` / native HLS** — present since **2.0.2**, in production 2.4.2
  `[liquidsoap-changes-main]{5}`. *Confirm: facet `ls-version-delta`.*
- **SRS WHIP/WHEP, SRS native DVR** — SRS-side, not Liquidsoap. *Confirm: facet `srs-ffmpeg-seam`.*

Current architecture baseline `[playout-render-seam]{6}`: per-channel `request.queue` + `fallback`
+ `output.url` rendered statically into `playout.liq`; broadcast is `fallback([live_source,
snc_tv_queue, channels[0]_source, blank()])` with the fallback target hardcoded to the first
playout channel; channel CRUD = regenerate-and-restart.

## The map

| Backlog item | Capability it needs | Verifying facet / version | Conditional feasibility read |
|---|---|---|---|
| `streaming-snctv-fallback-dynamic-channel` `[streaming-backlog-cluster]{7}` | ref-driven `switch()` tier predicate reading a DB-sourced `defaultPlayoutChannelId` (replace the hardcoded `channels[0]` fallback `[playout-render-seam]{6}`) | editorial-engine spike (settled, lens) + `ls-version-delta` | **shape-changed → newly-feasible-live.** The item assumes config-regen-at-build-time; the spike settles that a ref-driven `switch()` tier can carry the fallback channel and be mutated live, no restart. If the editorial-engine mechanism lands, this becomes a live ref mutation, not a config regen. |
| `streaming-snctv-broadcast-source-selector` `[streaming-backlog-cluster]{8}` | live source-priority switching among tiers (live creator / playout channel / scheduled event) via ref-driven `switch()` | editorial-engine spike (settled, lens) | **shape-changed.** The item is framed as admin-UI-over-static-config; the spike makes priority/source selection a live editorial control. The selector becomes the UI over the editorial-engine control plane rather than a config generator. Feasibility of the *engine* side is settled; the *UI* side is unaffected app work. |
| `streaming-programming-epg` `[streaming-backlog-cluster]{9}` | time-slot scheduling. Two candidate substrates: (a) API-side scheduler driving ref/`source.dynamic` mutations; (b) Liquidsoap-native cron thread / time-predicate `switch()` | `ls-version-delta` (cron 2.4.0; time-predicate idiom) + editorial-engine | **shape-changed (engine-feasible either way).** The schedule table + grid UI are unaffected app work. The *enactment* of a schedule against the running pipeline is newly clean: a time-predicate `switch()` or the cron thread `[liquidsoap-changes-main]{2}` can flip sources on a clock without restart. Item assumes "once the multi-channel model is in place"; the live-switching capability removes the restart barrier. **Disconfirming note below** — whether to schedule in the API or in-engine is an open design fork, not settled by capability alone. |
| `streaming-liquidsoap-single-queue-per-output` `[streaming-backlog-cluster]{10}` | live per-channel content swap (`source.dynamic`) + runtime output attach/detach so channel topology is not baked into static config `[playout-render-seam]{6}` | editorial-engine spike (settled, lens) + `ls-version-delta` | **shape-changed — partially superseded.** The item's stated triggers were "(a) channel count > ~5, (b) zero-downtime channel management, (c) channels share output streams dynamically." The spike shows `source.dynamic` swaps channel content live and runtime attach/detach adds/removes channel outputs live (with the one-sentinel-output constraint). So zero-downtime management (trigger b) and dynamic sharing (trigger c) are **engine-feasible today on 2.4.2** without the full "Liquidsoap is a dumb single-queue decoder" rearchitecture. The item may shrink from "rearchitect" to "drive the existing render seam with runtime attach/detach" — a design fork the editorial-engine work owns. |
| `streaming-premieres` `[streaming-backlog-cluster]{11}` | schedule-driven single-video playout at a wall-clock time (its own statement: "a playout channel can be configured to play a single video at a scheduled time") | `ls-version-delta` (cron / time-predicate) + depends-on `streaming-programming-epg` | **shape-changed.** Engine side rides the same scheduling primitive as EPG. Item already self-scopes the dependency on EPG; the live-switching + cron capability makes the "play one video at time T then resume" transition restart-free. Chat/countdown UI is unaffected app work. |
| `streaming-stream-scheduling` `[streaming-backlog-cluster]{12}` | none engine-side — a `stream_schedule` table + CRUD + channel-page display | n/a (app/DB) | **unaffected.** Pure application/DB work; no Liquidsoap/SRS capability is load-bearing. It *feeds* the EPG grid but needs no engine capability itself. |
| `streaming-subtitle-delivery-player` `[streaming-backlog-cluster]{13}` | player-side: wire already-extracted WebVTT to Vidstack `<Track>`. Extraction "already done" per the item. | n/a (Vidstack, player-side) — **NOT** the 2.5.0 Liquidsoap subtitles content-type | **unaffected by Liquidsoap version.** The item's blocker is player wiring, not engine capability; subtitle tracks are already stored. The 2.5.0 LS subtitles content-type `[liquidsoap-changes-main]{4}` is a *different* layer (in-pipeline subtitle handling) and is **not** what this item needs. **Do not conflate** (disconfirming note below). |
| `streaming-auto-captions` `[streaming-backlog-cluster]{14}` | ASR sidecar consuming SRS HLS/tapped audio → WebVTT; player delivery via Vidstack | `srs-ffmpeg-seam` (HLS tap) — **NOT** Liquidsoap subtitles content-type | **unaffected by Liquidsoap version (mostly).** The captioning is an external ASR sidecar producing WebVTT; the capability the item names is the SRS HLS output tap `[streaming-backlog-cluster]{14}`, not a Liquidsoap feature. The 2.5.0 subtitles content-type `[liquidsoap-changes-main]{4}` *could* matter only IF captions were injected *into* the Liquidsoap pipeline as a subtitle track rather than side-loaded to the player — a possible but unrequired path. Mark as **conditionally shape-changed** only under that injection design; **still-blocked-on-ASR-sidecar** otherwise. *Confirm injection-path relevance: facet `ls-2.5.0-capabilities`.* |
| `streaming-srs-dvr-recording` `[streaming-backlog-cluster]{15}` | SRS native DVR FLV recording triggered by `on_publish` | `srs-ffmpeg-seam` | **unaffected by Liquidsoap.** SRS-side. Liquidsoap version is irrelevant. |
| `streaming-dvr-rewind-live` `[streaming-backlog-cluster]{16}` | SRS native DVR rolling buffer + Vidstack DVR-aware seek bar; depends on SRS DVR recording | `srs-ffmpeg-seam` | **unaffected by Liquidsoap.** SRS + player-side. |
| `streaming-clip-creation` `[streaming-backlog-cluster]{17}` | SRS DVR output + timestamp access + media-pipeline clip extraction job | `srs-ffmpeg-seam` | **unaffected by Liquidsoap.** SRS DVR + media-pipeline. |
| `streaming-low-latency-webrtc` `[streaming-backlog-cluster]{18}` | SRS WHIP (ingest) + WHEP (playback); Vidstack WHEP | `srs-ffmpeg-seam` | **unaffected by Liquidsoap.** SRS-side delivery upgrade. |
| `streaming-abr-transcoding-strategy` `[streaming-backlog-cluster]{19}` | FFmpeg sidecar + VAAPI hardware ABR ladder; audio-only rendition | `srs-ffmpeg-seam` (transcoding seam) — **NOT** a Liquidsoap version feature | **unaffected by Liquidsoap version.** The transcoding is an FFmpeg/VAAPI sidecar concern. Liquidsoap currently re-encodes on the fly `[streaming-backlog-cluster]{20}`; ABR is a delivery-path rearchitecture, not unlocked by an LS version bump. |
| `streaming-multi-rendition-playout-transcoding` `[streaming-backlog-cluster]{20}` | only relevant "if serving HLS directly from S3 (bypassing Liquidsoap) or adding ABR" (its own statement) | `srs-ffmpeg-seam` / delivery rearchitecture | **still-blocked-by-design (unaffected by LS version).** The item self-scopes: only revisit if the delivery model changes. No LS capability changes its status. NOTE: `output.hls` has been in Liquidsoap since 2.0.2 `[liquidsoap-changes-main]{5}`, so "Liquidsoap serves HLS" is *technically* available, but the item's framing is about bypassing Liquidsoap, so the LS HLS capability doesn't directly apply. |
| `streaming-4k-rendition-support` (sibling, read) | transcode profile + storage + Vidstack quality track | `srs-ffmpeg-seam` | **unaffected by Liquidsoap.** Transcoding/storage/player. |
| `streaming-playout-content-table-unification` (sibling, read) | none engine-side — DB schema unification (`playout_items` + `content`) | n/a (app/DB) | **unaffected.** Pure DB/app work. |

## Cross-cutting observations

1. **The editorial-engine spike is the single biggest reshaper.** Four items
   (`snctv-fallback-dynamic-channel`, `snctv-broadcast-source-selector`,
   `single-queue-per-output`, and the engine side of `programming-epg` / `premieres`) all hinge on
   the same settled capability: live ref-driven `switch()` + `source.dynamic` + runtime
   attach/detach, no restart. Their backlog framing predates that spike, so each is written as
   "config-regen / multi-channel-model-first" — the spike collapses that prerequisite. The lead
   should treat these four as a cluster the editorial-engine epic largely subsumes.

2. **A clean Liquidsoap-side / SRS-side / player-side / app-side partition holds.** Liquidsoap
   version capability is load-bearing for the *editorial/topology* cluster only. The DVR/clip/WebRTC
   cluster is SRS-side (facet `srs-ffmpeg-seam`); captions/subtitles delivery is player-side; ABR is
   FFmpeg-sidecar-side. An LS version bump does **not** unblock the SRS/player/sidecar items.

3. **Two genuine upgrade-gated items (not in production 2.4.2):**
   `request.queue.remove` (2.4.5) `[liquidsoap-changes-main]{3}` would let the API remove a specific
   queued item without skip-to-clear — a quality-of-life improvement to the existing queue harbor
   endpoints `[playout-render-seam]{6}`, not tied to a specific backlog item but relevant to any
   queue-management UI. The 2.5.0 subtitles content-type is unreleased and only conditionally
   relevant (see auto-captions row). Neither is required by a current backlog item as written.

## Disconfirming analysis

Per discipline §5, before each load-bearing feasibility claim: is there evidence the item is NOT
newly-feasible / NOT shape-changed?

- **EPG (`programming-epg`) — is it actually newly-feasible?** Counter-evidence: the load-bearing
  work is the schedule table + grid UI + EPG output, none of which is a Liquidsoap capability. The
  engine can *enact* a schedule live, but that was already achievable via config-regen-and-restart
  (Option A, the item's stated prerequisite path). So the capability makes enactment *cleaner*
  (restart-free), not *possible-where-impossible-before*. Honest verdict: **shape-changed, not
  newly-feasible-from-blocked.** Marked accordingly.

- **`single-queue-per-output` — is it superseded?** Counter-evidence: the item's framing ("API is
  the orchestrator, Liquidsoap is the dumb single-track decoder") is an *architectural* preference,
  not only a capability gap. The spike shows runtime attach/detach + `source.dynamic` achieve the
  item's *functional* triggers (zero-downtime, dynamic sharing) without that rearchitecture — but a
  team could still *want* the dumb-decoder architecture for other reasons (config simplicity,
  testability). So "partially superseded" is the honest read: the functional drivers are met, the
  architectural preference is a separate decision. Not asserting the item is dead.

- **Captions/subtitles — am I over-attributing the 2.5.0 subtitles content-type?** Strong
  counter-evidence: both items terminate in the Vidstack `<Track>` API (player-side) per their own
  bodies `[streaming-backlog-cluster]{13}`. The subtitle-delivery item explicitly says extraction is
  "already done" and the remaining work is player wiring. The 2.5.0 Liquidsoap subtitles content-type
  operates *inside the pipeline*, a layer neither item requires as written. I have therefore marked
  both **unaffected by LS version**, with the injection path flagged as a *possible-but-unrequired*
  design only. This directly contradicts the campaign-brief example hypothesis ("likely map to 2.5.0
  subtitles content-type") — the item content does not support that mapping; the delivery is
  side-loaded WebVTT to the player. **Flagged for the lead: the seed hypothesis appears wrong; the
  item-as-written needs no LS subtitle feature.**

- **Is any "unaffected" actually secretly LS-dependent?** Checked the SRS-side cluster (DVR, WebRTC,
  clip): all reference SRS features (`on_publish` DVR trigger, WHIP/WHEP, DVR rolling buffer) with no
  Liquidsoap touchpoint. No hidden LS dependency found. ABR re-encoding *passes through* Liquidsoap
  today `[streaming-backlog-cluster]{20}` but the ABR strategy is explicitly an FFmpeg-sidecar
  rearchitecture, so the LS path is incidental, not load-bearing.

## Contradictions

- **Seed hypothesis vs item content (captions/subtitles).** The campaign brief offered "auto-captions
  + subtitle-delivery likely map to 2.5.0 subtitles content-type." The item bodies contradict this:
  both are player-side WebVTT/`<Track>` work; subtitle extraction is already done; captions are an
  external ASR sidecar. **Position taken:** map both to player-side, mark LS-version-unaffected; the
  2.5.0 content-type is relevant only under an unrequired in-pipeline-injection design. The lead
  should reconcile if the `ls-2.5.0-capabilities` facet surfaces a reason the in-pipeline path is
  preferable.

- **"Newly-feasible" vs "cleaner-but-already-possible" (EPG, single-queue).** Internal tension
  between calling these newly-feasible (capability-centric framing) vs shape-changed (the items were
  already achievable via config-regen-and-restart). **Position taken:** shape-changed, not
  newly-feasible — the restart path always existed; the spike removes the restart, not the
  impossibility. Recorded so the lead doesn't overstate the capability's effect.

## Revisit if

- The `ls-version-delta` facet finds `source.dynamic` / runtime attach-detach semantics differ from
  the editorial-engine spike's reading (the spike was sine-based; real `request.queue` /
  `input.rtmp` sources untested at the time) — re-grade the four editorial-cluster rows.
- The `ls-2.5.0-capabilities` facet finds the 2.5.0 subtitles content-type enables an in-pipeline
  caption path materially better than side-loaded WebVTT — re-grade the captions/subtitles rows from
  unaffected to shape-changed.
- The `srs-ffmpeg-seam` facet finds an SRS-side capability that an LS version bump could instead
  satisfy (unlikely given the clean partition) — re-check the SRS cluster's "unaffected by LS" reads.
- A backlog item is rescoped or its body rewritten — re-read; this map is keyed to item content as
  of 2026-06-16.
- The team adopts Liquidsoap 2.4.5+ (gets `request.queue.remove`) or a 2.5.0 release ships (gets
  subtitles content-type) — the two upgrade-gated capabilities move from "upgrade target" to
  "available," re-check any queue-management or in-pipeline-subtitle item.
