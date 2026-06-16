---
title: Liquidsoap version-delta + streaming-stack capability-gap audit
provenance: agent-synthesis
campaign: liquidsoap-version-capability-audit
updated: 2026-06-16
research_origin: unified-channel-model-editorial-engine
verification_rigor: full
related:
  - to: ../../positions/editorial-engine-switching-mechanism.md
    type: extends
    note: the spike this audit was commissioned to de-risk; this audit qualifies its 2.4.2 CRUD claim
  - to: ../../positions/liquidsoap-playout-engine.md
    type: cites
    note: the engine-selection position; this audit is a version/capability follow-up, not a re-selection
---

# Liquidsoap version-delta + streaming-stack capability-gap audit

Commissioned by the `unified-channel-model-editorial-engine` rearchitecture (the `[research]` item
`liquidsoap-version-capability-audit`). The editorial-engine spike established that live no-restart
switching works on our production **Liquidsoap 2.4.2**; this audit asks the next questions: what has
upstream fixed/added since 2.4.2, should we upgrade, and what does the wider streaming stack
(SRS 6, ffmpeg) offer the rearchitecture and the streaming backlog.

Four specialist facets, full-rigor verification (lint + adversarial + evaluator + spot-check). The
load-bearing claims are verified against **primary source** — the tag-pinned Liquidsoap tree diffed
across v2.4.2→v2.4.5 `[liquidsoap-src-version-delta]{1}` and `origin/main` (2.5.0-unreleased)
`[liquidsoap-src-main]{2}` — not against changelog text `[liquidsoap-changes-main]{3}` alone. The
four specialist briefs (named in §Provenance) carry the within-facet detail; this parent cites the
source-direct attestations they authored.

## The headline finding: every relevant fix since 2.4.2 is latent today, and activates exactly when the editorial design reaches for a richer primitive

A useful framing, verified across both Liquidsoap facets: our production render emits a
**deliberately simple graph** — `fallback` + `request.queue` + `output.url`, with channel CRUD done
by regenerate-and-restart `[playout-render-seam]{4}`. That graph sidesteps every 2.4.3–2.4.5 bug fix
relevant to us. None of them is *active* on what we run today. But each one **activates** precisely
as the editorial rearchitecture reaches for the primitives the spike validated:

| 2.4.x fix | Latent today because… | Activates when the editorial design… |
|---|---|---|
| skip-from-harbor crashes `cross`/`crossfade` (fixed 2.4.5, #5194) | no `cross` operator is emitted | adds a crossfade to a channel it also `skip()`s `[liquidsoap-src-version-delta]{1}` |
| `harbor.remove_http_handler` drops other handlers (fixed 2.4.5) | we never remove handlers | does channel CRUD via runtime harbor-handler removal `[liquidsoap-src-version-delta]{1}` |
| clock detach-while-running race (fixed 2.4.3, #5051) | we never detach at runtime | does channel CRUD via runtime `clock.detach` `[liquidsoap-src-version-delta]{1}` |
| sub-clock accumulation → CPU growth (fixed 2.4.3/2.4.4, #5032/#5103) | no child-clock operator emitted | introduces `source.dynamic` / `crossfade` into the days-long process `[liquidsoap-src-version-delta]{1}` |
| `request.queue.remove` (added 2.4.5, #5237) | n/a — a capability, not a bug | wants to pull a *specific* queued item (arm/take) without skip/flush `[liquidsoap-src-version-delta]{1}` |

So the upgrade question is **not** "is 2.4.2 broken for us?" (it isn't, for what we run) but "are we
about to build the exact things these fixes protect?" — and the editorial rearchitecture's roadmap
is yes to several of them.

## Upgrade recommendation: ship 2.4.5 now, lean on revertibility

**Recommendation: upgrade production 2.4.2 → 2.4.5 now, ahead of the editorial-engine
implementation.** This reflects the operator decision (2026-06-16) and the verified evidence:

- **The fixes are strict improvements on the paths the editorial work will use.** Runtime
  attach/detach (the channel-CRUD primitive the spike found) was materially hardened in 2.4.3/2.4.4
  — detach-while-running (#5051) and sub-clock-leak (#5032/#5103) fixes are *exactly* the
  attach/detach path `[liquidsoap-changes-main]{3}` `[liquidsoap-src-version-delta]{1}`. Doing the
  upgrade first means the editorial implementation builds on the hardened engine rather than
  discovering these bugs under load.
- **2.4.5 is a point release on the same 2.4 line** — no major-version API break in scope; the
  `switch()` selection semantics, `source.dynamic` getter contract, and `fallback` behavior our
  mechanism rests on are **unchanged** across 2.4.2→2.4.5 (verified by source diff, not assumed)
  `[liquidsoap-src-version-delta]{1}`.
- **Revertibility is the mitigation for thin regression coverage.** We do not have deep automated
  regression coverage of the streaming path, and the upgrade is a container base-image bump
  (`platform/liquidsoap/Dockerfile` `FROM savonet/liquidsoap:v2.4.2` → `v2.4.5`)
  `[liquidsoap-src-version-delta]{1}`. The honest posture is: ship it, watch the live stream, and
  revert the one-line Dockerfile pin if anything regresses — cheap because it's a pinned base image
  and our `.liq` is regenerated, not hand-migrated.

**Pre-upgrade checklist (small, mechanical):**
- Grep our rendered/static `.liq` for `source(video=canvas)` — a **breaking** annotation rename to
  `video=yuv420p` lands in 2.5.0, NOT 2.4.5, so 2.4.5 is unaffected; but do the grep now so the
  2.5.0 watch item is already discharged `[liquidsoap-src-main]{2}`.
- Grep for `liq_cross_start_duration` / `liq_cross_end_duration` and `start_duration`/`end_duration`
  crossfade usage — none expected (we have no crossfade code), but confirm before any later 2.5.0
  move `[liquidsoap-src-main]{2}`.
- After the bump, verify the live stream end-to-end (the editorial spike's harbor-control paths,
  skip/queue, the fallback chain) on staging before prod.

### Adversarial refutation of the upgrade (full-rigor requirement)

The case *against* upgrading now, stated fairly:
- **"It's latent — why pay any risk before we need it?"** Valid for a pure-maintenance framing. The
  rebuttal is sequencing: the editorial implementation is the *next* work, and discovering the
  clock-detach race or the skip-from-harbor crash mid-implementation is more expensive than taking a
  cheap, revertible bump first. If the editorial work were *not* imminent, "wait" would win.
- **"Thin regression coverage makes any bump risky."** Real, and the reason the recommendation is
  *ship-and-watch-with-revert*, not *ship-and-assume-fine*. The bump's blast radius is one pinned
  base image; revert is one line — a low-stakes, reversible upgrade shape.
- **"2.4.5 could carry its own new bugs."** Possible — but 2.4.5's changes beyond our paths are
  perf optimizations (#5133/#5136/#5137, O(1) sync-source + dispatch) with no behavior change to our
  operators, and the fixes we care about are localized to paths we don't yet exercise
  `[liquidsoap-src-version-delta]{1}`. The residual unknown is covered by revertibility.
- **Unreproduced-crash caveat.** The skip-from-harbor/crossfade crash (#5194) was confirmed by a
  *code read* of the synchronous `abort_track`→`wake_up` off-thread path, not a runtime repro
  `[liquidsoap-src-version-delta]{1}`. This does not weaken the upgrade case (the fix is real in
  source); it means "the 2.4.2 bug bites us" is asserted at code-read confidence, and a 2.4.2
  throwaway-container repro (crossfade + skip-from-harbor) is the disconfirming test if we ever want
  certainty.

**Net:** upgrade now; the decision is low-stakes and revertible, and it front-loads the engine
hardening the editorial work depends on. 2.5.0 is **not** part of this recommendation — see below.

## 2.5.0 adds no new switching/CRUD power — do not wait for it

Verified by diffing `origin/main` against v2.4.2: the 2.5.0-unreleased line adds **no new live
switching, dynamic-topology, or CRUD verb**; `switch()` and `source.dynamic` semantics are unchanged
`[liquidsoap-src-main]{2}`. The rearchitecture's primitives are already on 2.4.x and should not wait
for 2.5.0. What 2.5.0 *does* add, and its relevance to us:

- **Subtitles as a content type** (SRT decode, `%subtitle`, `on_subtitle`, `subtitles.insert`) —
  a carriage/insertion seam, **not** caption generation (no ASR in-engine). Its relevance to our
  caption backlog is weaker than the seed assumed — see the captions finding below
  `[liquidsoap-src-main]{2}`.
- **`source.content` / `track.format` introspection** — a genuinely useful *observability* axis for
  per-channel content typing (complements `switch.selected()`, doesn't replace it). A nice-to-have
  for a status surface when 2.5.0 ships `[liquidsoap-src-main]{2}`.
- **`icecast.server`** (inbound Icecast ingest, explicitly *experimental*) — orthogonal to our
  outbound RTMP→SRS path. No action `[liquidsoap-src-main]{2}`.
- **`cross` duration unification** + **`canvas`→`yuv420p` breaking annotation rename** — migration
  watch items for a *future* 2.5.0 move, not this upgrade `[liquidsoap-src-main]{2}`.

Treat 2.5.0 as "watch / pre-validate," not "available" — it is unreleased and its API is non-final
`[liquidsoap-changes-main]{3}`.

## Backlog feasibility: the editorial spike is the big reshaper; the stack partitions cleanly

The streaming backlog partitions into four layers, and a Liquidsoap version bump moves only one of
them `[streaming-backlog-cluster]{5}`:

**Editorial/topology cluster (reshaped by the spike, LS-side):** `snctv-fallback-dynamic-channel`,
`snctv-broadcast-source-selector`, `single-queue-per-output`, and the *engine* side of
`programming-epg` / `premieres`. All four were written assuming config-regen / multi-channel-first;
the spike collapses that prerequisite into live ref-driven `switch()` + `source.dynamic` + runtime
attach/detach `[streaming-backlog-cluster]{5}`. **Honest qualifier (verified):** for EPG and
single-queue this is *shape-changed, not newly-feasible-from-blocked* — they were already achievable
via regenerate-and-restart; the capability removes the *restart*, not the impossibility
`[streaming-backlog-cluster]{5}`. The editorial-engine epic largely subsumes this cluster.

**SRS-side cluster (LS-version-irrelevant):** `srs-dvr-recording`, `dvr-rewind-live`, `clip-creation`,
`low-latency-webrtc`, `4k-rendition`. SRS 6 already offers the capabilities — WHIP/WHEP on the same
ingest that feeds HLS `[srs-v6-webrtc-doc]{6}`, native DVR via `dvr_plan session` + `on_dvr`
`[srs-v6-dvr-doc]{7}`, and — below the HLS ~5s floor — HTTP-FLV (a low-cost, no-transcode latency
option SRS already exposes on the same ingest) `[srs-v6-hls-doc]{8}`. None needs a Liquidsoap change.

**Player-side cluster (LS-version-irrelevant):** `subtitle-delivery-player`, and the delivery half of
`auto-captions` — both terminate at Vidstack `<Track>` `[streaming-backlog-cluster]{5}`.

**ffmpeg-sidecar cluster (LS-version-irrelevant):** `abr-transcoding-strategy`,
`multi-rendition-playout-transcoding` — ABR/VAAPI work, to be done *outside* SRS (see below).

### The captions/subtitles correction (the discovery surface earned its keep)

The campaign seed hypothesized that `auto-captions` + `subtitle-delivery-player` map to the 2.5.0
subtitles content-type. **Two facets independently found this wrong.** The backlog items terminate
at the *player* (Vidstack `<Track>`); subtitle extraction is "already done"; captions need an
external ASR sidecar `[streaming-backlog-cluster]{5}`. The 2.5.0 Liquidsoap subtitle content-type is
an *in-pipeline* layer neither item requires as written `[liquidsoap-src-main]{2}`. Both items are
**unaffected by Liquidsoap version**; the in-pipeline-subtitle path is a possible-but-unrequired
design alternative, not the items' need. This is the `mixed` scope_authority working as intended —
the discovery surface corrected a seeded assumption.

### Two genuine upgrade-gated capabilities

Only two named capabilities are absent from production 2.4.2 `[liquidsoap-src-version-delta]{1}`:
- **`request.queue.remove`** (2.4.5) — selective queued-item removal without skip/flush; a
  quality-of-life primitive for any queue-management UI / arm-take editorial control. **The upgrade
  this audit recommends delivers it.**
- **subtitles content-type** (2.5.0, unreleased) — only conditionally relevant (see above)
  `[liquidsoap-src-main]{2}`.

## The VAAPI/ABR finding: encode outside SRS

A clear stack-wide finding from the SRS facet, worth surfacing because it pre-empts a likely design
mistake: **do not route ABR/VAAPI hardware encoding through SRS's transcode block.** SRS's transcode
restricts the encoder to software `libx264` — issue #3267 is Closed/Won't-fix for hardware accel
`[srs-issue-3267-hwaccel]{9}`, and the `full.conf` `vcodec` list enumerates only
`libx264`/`copy`/`png`/`vn` `[srs-fullconf-source]{10}`. The supported home for VAAPI (the
prior-research requirement: Intel UHD 630 / i7-10700, CQP) is an **upstream ffmpeg** — either
Liquidsoap's `%ffmpeg` encoder or a dedicated ffmpeg sidecar (which is what the
`abr-transcoding-strategy` backlog item already proposes) `[srs-issue-3267-hwaccel]{9}`. Our live
path is single-bitrate `libx264`/ultrafast end-to-end today; VAAPI and ABR are both unused
`[srs-fullconf-source]{10}`. Whether `h264_vaapi` works in Liquidsoap's `%ffmpeg` encoder is the one
open LS-side question this audit did not close (flagged below).

## Contradictions (surfaced, not resolved by paraphrase)

- **DVR-as-rewind.** `streaming-dvr-rewind-live` (backlog) states live rewind is "enabled by SRS
  native DVR" `[streaming-backlog-cluster]{5}`. The SRS docs show DVR is *server-side file recording*
  (`dvr_plan`) `[srs-v6-dvr-doc]{7}`, while a player's seekable live window is a *delivery-format*
  property (HLS `hls_window`) `[srs-v6-hls-doc]{8}`. These are different mechanisms; the conflation
  is left side-by-side for that item's design (a plausible reconciliation: recent window from HLS,
  longer rewind from DVR-backed VOD — but that is a design decision, not a sourced fact).
- **"Possible" vs "production-safe" on 2.4.2 (qualifies the spike position).** The editorial-engine
  spike position states runtime attach/detach "IS supported" on 2.4.2. That is correct that the
  *mechanism exists* (`clock.ml` exposes attach/detach). This audit qualifies it: runtime *detach* is
  on the *unfixed* side of #5051 on 2.4.2 (race fixed 2.4.3), and the sub-clock CPU-growth bug
  (#5032) sits on the same path `[liquidsoap-src-version-delta]{1}`. "Possible" ≠ "race-safe." The
  upgrade recommendation discharges this gap.

## Open questions (carried, not closed)

- **`h264_vaapi` in Liquidsoap's `%ffmpeg` encoder** — does it work on 2.4.x? Determines whether the
  VAAPI requirement is met upstream (Liquidsoap encoder) or needs a separate ffmpeg sidecar. Not
  closed by this audit; a liquidsoap-encoder spike answers it `[srs-issue-3267-hwaccel]{9}`.
- **SRS max streams / vhosts for dynamic channels** — the docs gave only `max_connections`, not a
  stream cap; a dev-container scaling test or SRS source read answers it `[srs-fullconf-source]{10}`.
- **#5032 leak rate on a days-long process** — the changelog says "gradual CPU growth," no number; if
  we stay on 2.4.2 and ship `source.dynamic`, measure it. (The upgrade recommendation makes this moot
  by moving off 2.4.2.) `[liquidsoap-changes-main]{3}`.
- **#5194 severity** — code-read confidence; a 2.4.2 crossfade + skip-from-harbor repro confirms
  `[liquidsoap-src-version-delta]{1}`.

## Provenance

This parent cites source-direct attestations by handle; the four specialist briefs carry the
within-facet detail and their own `[handle]{N}` chains:

- `specialists/ls-version-delta.md` — source-diff verification v2.4.2→v2.4.5 (attestations
  `[liquidsoap-src-version-delta]{1}`, `[liquidsoap-changes-main]{3}`, `[playout-render-seam]{4}`)
- `specialists/ls-2.5.0-capabilities.md` — origin/main, 2.5.0-unreleased (`[liquidsoap-src-main]{2}`)
- `specialists/backlog-feasibility-map.md` — backlog × capability map (`[streaming-backlog-cluster]{5}`)
- `specialists/srs-ffmpeg-seam.md` — SRS 6 + ffmpeg (`[srs-v6-webrtc-doc]{6}`, `[srs-v6-dvr-doc]{7}`,
  `[srs-v6-hls-doc]{8}`, `[srs-issue-3267-hwaccel]{9}`, `[srs-fullconf-source]{10}`,
  plus `srs-v6-forward-doc`, `srs-v6-http-callback-doc`, `srs-github-codecs-changelog` cited in the brief)

### Bibliography (source-direct attestations, `.research/attestation/`)

1. `liquidsoap-src-version-delta` — tag-pinned LS source diffed v2.4.2→v2.4.5 (file:line, tag SHAs)
2. `liquidsoap-src-main` — LS `origin/main` (2.5.0-unreleased line, HEAD 2026-06-15)
3. `liquidsoap-changes-main` — the upstream CHANGES.md (all versions through 2.5.0)
4. `playout-render-seam` — our render code (`apps/api/src/services/liquidsoap-render.ts`)
5. `streaming-backlog-cluster` — our streaming backlog items (`.work/backlog/`)
6. `srs-v6-webrtc-doc` — SRS v6 WebRTC (WHIP/WHEP) documentation
7. `srs-v6-dvr-doc` — SRS v6 DVR documentation
8. `srs-v6-hls-doc` — SRS v6 HLS documentation
9. `srs-issue-3267-hwaccel` — SRS GitHub issue #3267 (hardware-encode Won't-fix)
10. `srs-fullconf-source` — SRS `trunk/conf/full.conf` (transcode `vcodec` list, max_connections)
