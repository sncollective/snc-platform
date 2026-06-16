---
title: Adversarial-read verification checklist — liquidsoap-version-capability-audit
provenance: agent-synthesis
campaign: liquidsoap-version-capability-audit
updated: 2026-06-16
verification_stage: adversarial-read
---

# Adversarial-read verification checklist

Fresh-context skeptical pass over the parent synthesis + four specialist briefs + cited
attestations, with independent source spot-verification against the cloned Liquidsoap tree
(`/workspaces/SNC/platform/.memory/scratchpad/liquidsoap-src`, tags v2.4.2..v2.4.5 + origin/main)
and the current render seam (`apps/api/src/services/liquidsoap-render.ts`).

**VERDICT: APPROVED with one required correction (R1) and three recommended polish items (R2–R4).**
The upgrade recommendation, the latent-not-active frame, the captions reversal, and the
position-qualification are all sound and source-grounded. One factual citation error (a
mis-attributed issue number) must be fixed; it does not change any conclusion.

---

## Per-job findings (a–h)

### (a) Semantic citation-chain walk — PASS
Walked every load-bearing parent claim back to its cited attestation and confirmed the
attestation *semantically* supports the claim, then independently re-verified the four
highest-stakes version-presence claims in source:

- `request.queue.remove`/`remove_request_id` added 2.4.5, absent 2.4.2 — **re-verified**:
  `git grep remove_request_id` → 0 hits at v2.4.2, 5 hits at v2.4.5 (`src/libs/request.liq`).
  Supports parent §"Two genuine upgrade-gated capabilities" and the headline table.
- #5051 clock-detach-while-running fixed 2.4.3 — **re-verified**: `do_detach` helper absent in
  v2.4.2 `clock.ml`, present in v2.4.3. Supports the "race fixed 2.4.3, unfixed on 2.4.2" claim
  that the position-qualification rests on.
- #5194 skip-from-harbor cross crash fixed 2.4.5 — **re-verified**: `pending_abort_track` absent
  in v2.4.4 `cross.ml`, present in v2.4.5. Localization to 2.4.5 holds.
- harbor.remove_http_handler fix in 2.4.5 — **re-verified**: `Atomic.set handler.http remaining`
  absent v2.4.4, present v2.4.5.
- `switch()`/`fallback` semantics unchanged 2.4.2→2.4.5 — **re-verified**: `switch.ml` diff
  contains only `notify_sync_source` additions + `Invalid_value` arity `[]`; the `satisfied`
  predicate-selection core is untouched; `switches.liq` (the `fallback`/`switch` builtin) has
  **zero** changes across the range; `switch.ml` predicate core also unchanged on origin/main.
  Fully supports the parent's "selection semantics our mechanism rests on are unchanged
  (verified by source diff, not assumed)" — this is the answer to special-scrutiny #1's "verified
  or assumed?": **verified for the operators we use.**

Every `[handle]{N}` in the parent resolves to a source-direct attestation. No chain breaks.

### (b) Claim-shapes the mechanical lint missed — ONE ERROR FOUND (R1)
- **R1 (required fix): mis-attributed issue number.** Parent headline table, line 43:
  `harbor.remove_http_handler drops other handlers (fixed 2.4.5, #5237)`. **#5237 is the issue
  number for `request.queue.remove`, NOT for the harbor fix.** Verified in the 2.4.5 changelog:
  the `remove`/`remove_request_id` entry carries `(#5237)`; the `harbor.remove_http_handler` entry
  carries **no issue number at all**. The specialist brief (Claim 3) correctly omits a number; the
  error was introduced when the parent table compressed the entries. Fix: drop `#5237` from the
  harbor row (the changelog gives no issue number for that fix). Does not change the upgrade
  conclusion, but it is a factual citation defect that a reader could chase into the wrong PR.
- No plausible-attribution-without-citation found. No cite-through over-extension found.
- Comparatives framed as descriptions — see (e); they are analytically framed, not asserted as
  source facts.

### (c) Coherence-read for smoothed contradictions — PASS
The parent does NOT paper over the two genuine contradictions; it carries both under an explicit
`## Contradictions` heading with named positions side-by-side and no resolution-by-paraphrase:
- DVR-as-rewind (backlog "enabled by SRS native DVR" vs SRS docs "DVR is server-side file
  recording; seekable window is a delivery-format property") — left side-by-side, reconciliation
  flagged as a design decision not a sourced fact. Matches the srs-ffmpeg-seam brief verbatim.
- "Possible" vs "production-safe" on 2.4.2 — carried as a qualification of the position, not a
  merge. Honest.

### (d) Noise-domination / relevance-weighting — PASS
Read all SRS attestations (webrtc, hls, dvr, fullconf, issue-3267, codecs-changelog), not just
the cited spans. No more-relevant attestation went uncited. The webrtc attestation explicitly
marks latency `[unquantified-here]`; the parent correctly does NOT assert a WebRTC millisecond
figure (it frames WebRTC only as the relatively-lowest-latency tier). The fullconf `vcodec`
list (libx264/copy/png/vn) and issue-3267 Won't-fix are both cited where the VAAPI-outside-SRS
finding leans on them. The most-relevant attestation is cited in each case.

### (e) Quote-context walk — PASS
Verbatim/near-verbatim quotes retain their source qualifiers:
- HLS "won't go below ~5s" is attributed to `[srs-v6-hls-doc]{8}`, whose passage carries the
  `[unverified-exact]` marker; the parent does not over-harden it.
- "cheapest unused latency win" (HTTP-FLV) carries the source's own "no transcode, no new ingest"
  grounding from the srs-ffmpeg-seam brief — a relative-cost anchor, not a stripped absolute.
- The #5194 crash is consistently presented WITH its "code-read, not runtime-reproduced"
  qualifier in every place it appears (headline table footnote, adversarial-refutation bullet,
  open-questions). No qualifier-stripping.

### (f) Analytical-tier-inheritance walk — PASS (clean)
The editorial-engine position is referenced 28 times as "lens"/"position" framing and **never**
as a `[handle]{N}` citation target (grep-confirmed: zero numbered handles resolve to the position
file). It is used strictly as comparison-framing — "the position states X; this audit qualifies
it." The parent does not assert the position's claims as source fact; where the position's
"runtime CRUD is supported" reading is used, the parent immediately re-grounds it in
`[liquidsoap-src-version-delta]{1}` (the #5051/#5032 source evidence). Lens discipline fully
honored.

### (g) Line-reference walk — PASS
- Render-seam line anchors verify: `snc_tv = fallback(...[live_source, snc_tv_queue,
  fallbackSourceVar, mksafe(blank())])` is at lines 154–156 as the attestation states.
- The position's `satisfied d` switch.ml claim verifies in v2.4.2 source (`satisfied d &&
  may_select ~single s` in the selection loop) — the predicate is applied fresh each cycle, as
  claimed.
- The Dockerfile pin `FROM savonet/liquidsoap:v2.4.2` is line 1 as cited.

### (h) Thin-attestation check (semantic) — PASS
No substantively thin attestation is carrying a per-claim citation. The two `source-direct`
Liquidsoap source attestations are richly detailed (file:line diffs, tag SHAs, verbatim code
blocks). The SRS attestations are `substrate_confidence: search-summary` (WebFetch model
summaries) — appropriately thinner, and every claim built on them is marked relative/qualitative
or flagged `[unverified-exact]`; the parent never hardens an SRS search-summary into an absolute.
The confidence ceiling is correctly propagated.

---

## Special-scrutiny items (1–5)

### 1. Is "ship 2.4.5 now, revert if breaking" supported? Is "no API break on our paths" verified or assumed? — SUPPORTED / VERIFIED (with one nuance, R2)
The "no API break on our paths" claim is **source-verified, not assumed**, for the operators we
emit: `switch`/`fallback`/`request.queue`/`output.url`/`harbor.http`/`source.skip` all have
unchanged contracts 2.4.2→2.4.5 (re-confirmed in (a)). The revert posture is honestly grounded
(one-line Dockerfile pin, regenerated `.liq`). The adversarial-refutation section states the
case against fairly and the residual-unknown→revertibility mapping is sound.

- **R2 (recommended): the range is not break-free, just break-free *on our paths*.** There IS one
  breaking "Changed:" entry in the range — `self_sync` removed from `input.jack`/`output.jack`
  (#5017, 2.4.3) — plus "Reduced default buffer size throughout the app" (2.4.3) and a
  `request.on_air` telnet deprecation. **Verified none touch our render seam** (no `input.jack`/
  `output.jack`/`buffer`/`on_air` usage in `liquidsoap-render.ts`), so the parent's "on our paths"
  qualifier is accurate and load-bearing. The recommendation is unaffected. But the parent's
  pre-upgrade-checklist could note that the "on our paths" scoping was checked against the actual
  changelog "Changed:" entries, not only the code diff of operators-we-use — the specialist's scan
  was code-diff-of-46-files; the changelog "Changed:" surface is slightly different and was not
  explicitly reconciled in the briefs. Minor completeness note; does not weaken the conclusion.

### 2. Is "latent not active" accurate — does NONE of the 2.4.3–2.4.5 fixes affect the current production graph? — ACCURATE (independently verified)
Grepped the current render seam directly: it contains **no** `cross`, `crossfade`,
`source.dynamic`, `clock.detach`, `remove_http_handler`, or `switch(` — only `fallback` +
`request.queue` + `output.url` + `harbor.http` + `skip()`. Every 2.4.3–2.4.5 bug fix the audit
maps is therefore genuinely latent (not on today's graph) and genuinely activates exactly when the
editorial design reaches for the richer primitive. The frame is correct and now independently
source-confirmed, not just asserted from the specialist.

### 3. Is the captions/subtitles reversal sound, or did the specialists misread? — SOUND
Read the two backlog item bodies directly. `streaming-subtitle-delivery-player` literally says
extraction is "already done" and terminates at the Vidstack `<MediaPlayer>` track API.
`streaming-auto-captions` literally says "Speech-to-text... Runs as a sidecar process consuming
the SRS HLS output or a tapped audio stream." Both terminate at the player; neither requires an
in-pipeline Liquidsoap subtitle layer. The 2.5.0 subtitles content-type is correctly characterized
as carriage/insertion (no ASR) — verified in `liquidsoap-src-main` (`subtitles.insert` takes
caller-supplied text; no speech-to-text surface). The reversal of the seed hypothesis is
well-grounded; the specialists did not misread.

### 4. Is the "possible ≠ production-safe on 2.4.2" qualification fair to the position, or a strawman? — FAIR
The position (authored on a 2.4.2-only source dive) states runtime attach/detach "IS supported"
and explicitly that it proves CRUD is *possible*, not the right tradeoff. The position does **not**
mention #5051 or the detach-while-running race (it couldn't — it didn't diff later tags). The
audit's qualification adds genuinely new information: runtime *detach specifically* is on the
*unfixed* side of #5051 on 2.4.2 (race fixed 2.4.3), and the sub-clock leak #5032 sits on the same
path. This is a true, source-verified refinement of "supported" → "the mechanism exists but the
runtime-detach reliability improves materially at 2.4.3." Not a strawman — the parent preserves
the position's actual claim ("mechanism exists / possible") and narrows only the
production-safety reading. Fair.

### 5. Composed-claim / superlative / uncited-named-feature violations — ONE BORDERLINE (R3), otherwise CLEAN
- **No composed effort estimates.** The parent carries zero dev-day/hour/week estimates; the SRS
  brief explicitly declines to quantify ("I do not quantify the gain"). Discipline §6 honored.
- **R3 (recommended): "cheapest unused latency win" (line 147)** is a mild superlative. It is
  grounded (HTTP-FLV needs no transcode / no new ingest, cited to `[srs-v6-hls-doc]{8}` and the
  srs-ffmpeg-seam brief), so it reads as a relative-cost anchor rather than a bare superlative —
  acceptable, but could be softened to "the lowest-implementation-cost latency option SRS already
  offers" to fully clear discipline §6's comparative-superlative fence.
- "the lowest-stakes shape an upgrade can take" (line 93) and "the single most useful frame"
  (line 34) are analytical framings of the synthesis's own reasoning (blast-radius argument /
  organizing principle), self-defended in context, not source-attributed facts — acceptable.
- No named-feature claim without citation found; every named LS/SRS capability carries a handle.

---

## Required / recommended revisions

- **R1 (REQUIRED): fix the mis-attributed issue number.** Parent headline table line 43 —
  `harbor.remove_http_handler ... (fixed 2.4.5, #5237)` → remove `#5237` (the harbor fix has no
  issue number in the changelog; #5237 belongs to `request.queue.remove`). Factual citation error.
- **R2 (recommended): note the changelog "Changed:" surface.** Add one line to the pre-upgrade
  checklist acknowledging the range carries a breaking `self_sync` removal (#5017) + buffer-size
  default change + `request.on_air` deprecation, all verified NOT on our render-seam paths — so the
  "on our paths" qualifier is checked against the changelog "Changed:" entries, not only the
  operator code diff.
- **R3 (recommended): soften "cheapest unused latency win"** to a relative-cost phrasing to fully
  clear the comparative-superlative fence.
- **R4 (optional polish): the parent's own provenance list** does not enumerate
  `srs-v6-http-callback-doc` / `srs-v6-forward-doc` / `srs-github-codecs-changelog` in the
  numbered bibliography (they appear only in the §Provenance note as "cited in the brief"). All
  three attestations exist and resolve; this is a bibliography-completeness nicety, not a chain
  break.

## What the verdict rests on
Independent source re-verification (not just trust of the briefs) confirmed all four load-bearing
version-presence claims, the unchanged switch/fallback core, and the empty-of-rich-primitives
current render seam. The single factual defect (R1) is a wrong issue number that does not move any
conclusion. With R1 applied, the synthesis is sound and ships.
