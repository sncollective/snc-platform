---
title: "Adversarial verification checklist — vidstack-layout-behavior campaign"
provenance: agent-verification
updated: 2026-06-14
campaign: vidstack-layout-behavior
stage: adversarial-read
verdict: APPROVED
---

# Adversarial verification checklist — vidstack-layout-behavior

Fresh-context adversarial pass over `parent.md` + the three specialist briefs + 16 attestations,
with spot-reads of the installed `@vidstack/react@1.12.13` source and the platform player files.
Verdict per ARD adversarial-reader jobs (a)–(h) below.

Lint context honored: the 8 `unreachable-source` flags are vidstack.io doc URLs whose liveness
re-check fails only because the sandbox blocks outbound network — the chains are intact, not
broken. The one real pattern flag (comparative-superlative "lowest-risk option", parent §5) is
addressed under job (b).

---

## (a) Semantic citation-chain walk — each load-bearing claim supported by its cited attestation

Spot-read the installed source for every load-bearing local-path citation. All resolve with the
attestation's recorded line numbers matching the actual file:

- **§1 zero-specificity 16/9 rule** [vidstack-base-css]{1,2,3} — verified `base.css` lines 7-15
  (player root `width:100%`, no height), lines 21-23 (`:where([data-media-player][data-view-type='video']) { aspect-ratio:16/9 }`). Attestation line refs exact.
- **§1 `aspectRatio` prop → inline style** [vidstack-react-player-bridge]{1} — verified
  `dev/vidstack.js` lines 200-216: `style: { aspectRatio, ...props.style }`. Quoted code is
  byte-faithful to source.
- **§1 platform passes `aspectRatio="16/9"`** [platform-video-player-tsx]{1} (line 37, unconditional),
  [platform-global-player-css]{1} (global-player.tsx line 129, conditional on `!isAudio`). Both verified.
- **§1/§5 NO `aspect-ratio: inherit` flip on `[data-started]:not([data-controls])`** [vidstack-base-css]{4} —
  verified `base.css` lines 30-33 carry ONLY `pointer-events:auto; cursor:none`. The central
  disconfirming finding is source-grounded.
- **§2 smLayoutWhen `width<576 || height<380`** [vidstack-layout-js]{1} — verified
  `dev/chunks/vidstack-BIA_pmri.js` line 1289. `data-sm`/`data-lg`/`data-size` on the layout div
  (lines 79-81), not `[data-media-player]` [vidstack-layout-js]{3} — verified.
- **§3 controls `position:absolute; inset:0`, sibling of provider** [vidstack-controls-css]{1}
  [vidstack-theme-css-controls]{1,2} — verified `controls.css` lines 32-45; provider `overflow:hidden`
  at `base.css`/`theme.css` lines 45-54. Sibling-not-child relationship is the correct reading.
- **§3 negative-margin mechanism** [vidstack-video-layout-css]{1,3,4} — verified `video.css`
  lines 67-72 (`nth-last-child(2) { margin-bottom:-16px }`), lines 455-459 (small `last-child
  { margin-top:-2.5px; margin-bottom:-6px }`), lines 461-463 (fullscreen small `last-child
  { margin-bottom:0 }`). Line refs exact.
- **§4 `--video-border-radius` default 6px / `--media-controls-padding` default 0px** — verified
  in `video.css` and `controls.css` respectively.

**Finding: nothing adverse.** Every load-bearing local-path claim is semantically supported by
the cited attestation, and each attestation is semantically supported by the actual installed source.

## (b) Claim-shapes the lint missed — uncited attributions, over-extended cite-throughs, comparatives-as-description

- **Real comparative-superlative (lint-flagged, confirmed):** parent §5 — "This is the lowest-risk
  option that keeps the controls and the rounded corners." This is a composed comparative
  (ARD §6) presented as description. **Mitigant:** the artifact does not leave it bare — the very
  next paragraph ("Alternatives weighed: (a)… (b)…") names the two alternatives and the concrete
  reason each is worse (option (a) leaves controls hanging below the video; option (b)
  `--media-controls-padding` "does not cleanly cancel a group's negative margin"). The superlative
  is earned by an inline side-by-side, not asserted from nothing. **Recommendation (non-blocking):**
  soften to "preferred — it keeps both the controls and the rounded corners, unlike the two
  alternatives below" to retire the bare-superlative shape. Does not gate approval.
- **No uncited plausible attributions found.** Every factual claim in parent.md carries a `[handle]{N}`.
- **No over-extended cite-throughs.** No "X attributes to Y" constructions; all citations are
  in-corpus direct.

## (c) Coherence-read for smoothed contradictions

The `## Contradictions` section preserves three divergences without resolution-by-paraphrase:
premise-vs-source (the absent `aspect-ratio:inherit` flip, correctly typed as an *absence* from the
sole authoritative source, not a source-vs-source contradiction); documented-vs-empirical tension
(docs silent on prop→CSS mapping, source explicit — labeled "consistent"); and the open
`'never'` vs `false` coercion question (labeled non-load-bearing). **Finding: no smoothed
contradiction.** The "absence is not a contradiction" distinction is handled correctly and
honestly — the seed's premise is overturned in the open, not quietly dropped.

## (d) Noise-domination / relevance-weighting — most-relevant citation chosen per claim

Read all attestations bearing on each major claim. The synthesis consistently cites the
*most* source-proximate attestation:

- Aspect-ratio claims cite the installed-source attestations (vidstack-base-css, -react-player-bridge),
  not the weaker docs attestation (vidstack-docs-media-player-api), which is correctly relegated to
  the "docs are silent" tension entry.
- The §4 customization-surface claims pair the source attestation (vidstack-video-layout-css,
  vidstack-pkg-installed-css) with the docs attestation (vidstack-docs-default-layout) — source for
  the mechanism, docs for the intended-API framing. Appropriate weighting, not noise substitution.

**Finding: no less-relevant citation displacing a more-relevant one.**

## (e) Quote-context walk — verbatim quotes not stripped of a source qualifier

The parent's only block-quoted verbatim is the proposed *fix* CSS (authored by the synthesis, not
quoted from a source — correctly not citation-anchored). Verbatim doc strings ("can be less
accurate", the slot list) live in the F3 brief and attestations with their qualifiers intact
(e.g. the streamType recommendation keeps its "(e.g., at identifying DVR support)" hedge).
**Finding: no quote stripped of a load-bearing qualifier.**

## (f) Analytical-tier-inheritance walk — no analytical artifact cited as source-attested

Every `[handle]{N}` in parent.md targets a per-source attestation (installed source files or
vidstack.io docs). No citation points at a specialist brief, a position, or the parent itself.
The lens-not-substrate guard holds. **Finding: nothing adverse.**

## (g) Line-reference walk — cited line/section ranges exist and support the claim

Spot-checked the load-bearing ranges against the installed files:
- `base.css` 7-15, 21-23, 30-33, 45-54, 75-84 — all exist, all support their claims. ✓
- `video.css` 55-61, 67-72, 74-79, 451-453, 455-459, 461-463, 575-577, 586-590 — all exist and match. ✓
- `controls.css` 7-13, 32-45, 53-56 — exist and match. ✓
- `dev/vidstack.js` 200-216 — exists, matches. ✓
- `dev/chunks/vidstack-BIA_pmri.js` 1289-1298, 79-81, 1107-1108 — exist, match. ✓
- platform `video-player.tsx` 37, `global-player.tsx` 129, `global-player.module.css` 9-12/31-43/130-133,
  `live.module.css` 150 (`.playerContainer { aspect-ratio:16/9; overflow:hidden }`) — all exist; the
  parent §5 "live `.playerContainer`" wrapper claim is verified against live.module.css. ✓

**One minor non-load-bearing discrepancy (specialist F2 only, not parent.md):** F2 §2 labels the
`video.css` line 575-577 rule (`[data-fullscreen] … nth-last-child(2) { margin-bottom:-16px }`) as
"In fullscreen (portrait)". The actual rule is **unconditional within fullscreen** — only the
`-12px` landscape variant (lines 586-590) is `@media`-gated; there is no portrait media query on the
-16px rule. This mislabel is confined to the specialist brief, does not propagate into any parent
claim, and the cited line range is correct. Flagged for cleanup, not blocking.

## (h) Thin-attestation semantic check — attestations able to support per-claim citation

Lint reports 0 thin. Confirmed semantically: each attestation carries the actual source rule text
(not a bare pointer), with frontmatter `source_handle` + `source_path`-or-`source_url` +
`provenance: source-direct`. The `vidstack-pkg-installed-css-1-12-13` attestation is a large
catalog of CSS-var defaults and is cited for exactly those enumerations (§4 var namespaces) — its
breadth matches its use. The docs attestations (vidstack-docs-*) are paraphrase-shape and are cited
only for intended-model / API-surface claims, never for source-mechanism claims — their granularity
is sufficient for the citing claims. **Finding: no thin attestation under any load-bearing citation.**

---

## Verdict: APPROVED

The synthesis is citation-sound: every load-bearing claim chains claim → `[handle]{N}` →
attestation → actual installed source, and the spot-reads confirm the attestations are faithful to
the source at the recorded line ranges. The central disconfirming finding (the seed's
`aspect-ratio:inherit` flip does not exist in v1.12.13) is correctly grounded as an absence and
drives the §5 fix honestly. Contradictions are surfaced structurally without paraphrase-resolution.

Two non-blocking cleanups (neither gates approval):
1. **parent §5** — soften "the lowest-risk option" (bare comparative-superlative, ARD §6) to a
   form that points at the inline alternatives it already names, e.g. "preferred over the two
   alternatives below because…".
2. **specialist F2 §2** — correct the "In fullscreen (portrait)" label on the `video.css` 575-577
   rule; that `-16px` rule is unconditional within `[data-fullscreen]`, only the `-12px` variant is
   landscape-media-gated. Does not affect any parent claim.
