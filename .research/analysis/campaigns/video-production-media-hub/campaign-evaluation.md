---
title: "Campaign evaluation — video-production-media-hub"
campaign: video-production-media-hub
gate: evaluate
updated: 2026-06-23
---

# Campaign evaluation (isolated-context gate)

The `evaluate` gate ran isolated — only the synthesis (`parent.md`) + the engagement seed, no
briefs/attestations/decomposition. First-pass verdict and disposition below.

## Per-component assessment (first pass)

- **Coverage — 4/5.** Q1 (editor matrix + OpenShot), Q2 (integration path, infra-open), Q3 (D
  bridge + sequencing) fully addressed. **Gap: Q4's "anchored to the album timeline" was absent**
  — the recommendation answered "what and in what order" but not "in time for what." Caught
  precisely because the gate is isolated from the decomposition rationale.
- **Coherence — 5/5.** Headline → section elaboration is consistent; the `melt`-substrate thread
  runs cleanly from editor selection through the build ladder; join-seams smooth.
- **Contradictions — 5/5.** The facet-1/facet-3 HTTP-media tension is substantive, typed
  (`qualifies`), named-source side-by-side, resolution held empirical/deferred — explicitly
  not smoothed.
- **Groundedness — 3/5.** Citation posture mostly disciplined (confirmed-vs-unconfirmed marked
  throughout; composed-claim fence honored). Flagged uncited factual clauses for spot-check:
  Pasolino named-project, Kdenlive proxy auto-substitution, OTIO JS-bindings.
- **Recommendations.** Priority-ordered: (1) album-timeline anchoring; (2) cite/de-assert the
  uncited clauses; (3) one consolidated ordered recommendation; (4) tighten §4 effort-adjacent
  phrasing.

**First-pass verdict: NEEDS-REVISION.**

## Disposition (revision applied by lead, 2026-06-23)

All four targets addressed in `parent.md`:

1. **Album-timeline anchoring** — added `## Recommendation (consolidated, sequenced)`, anchoring
   the build ladder + D-vs-B call to the album schedule as a **relative frame** (before-video-work
   / during-production / review-bridge / post-album). Concrete dates are explicitly left as an
   operator input — not fabricated (substrate-before-stance + composed-claim discipline).
2. **Uncited clauses cited** — Pasolino → `[pasolino-remote-renderer]{1}`; Kdenlive proxy
   auto-substitution → `[kdenlive-proxy-docs]{1}`; OTIO JS bindings → `[otio-repo-and-bindings]{1}`.
3. **Consolidated recommendation** — the new section fuses editor selection + media path + build
   ladder order + D timing into one ordered plan.
4. **§4 effort-adjacent phrasing** — "non-trivial integration" → "brings its own auth-bridging and
   storage-bridging work"; "the simpler path" → "the more platform-native path."

Re-lint after revision: no `unresolved-handle` / `colliding-handle`; residual "broken" are all
`unreachable-source` (URL-liveness on bot-blocking sites), low severity, non-blocking. The two
`adversarial-read` §1 defects (otio-adapters mis-citation; rclone-mount-vfs named-software
attribution) were fixed before this gate. Lead spot-check: corrections confirmed in place.
