---
campaign: vidstack-layout-behavior
updated: 2026-06-14
gate: evaluate (isolated-context, ARD SPEC §7) + spot-check
---

# Campaign evaluation — vidstack-layout-behavior

## evaluate (isolated context: synthesis + seed only) — VERDICT: APPROVED
- **Coverage 5/5** — all four seed questions mapped (§2/§3 = Q1; §1 = Q2; §5 = Q3; §4 = Q4); both stated outputs (cited reference + concrete fix) delivered.
- **Coherence 5/5** — §1→§3→§5 causal spine non-circular; the fix mirrors a mechanism the synthesis itself surfaced (fullscreen small-layout reset).
- **Contradictions 5/5** — substantive `## Contradictions` (premise-absence, documented-vs-empirical tension, open `'never'`/`false`) typed honestly, not smoothed; separate `## Disconfirming analysis`.
- **Groundedness 4/5** — strong citation posture + primary-source/docs split; −1 only because precise composed/computed values (specificity tuples, px constants, slot count, fix selectors) warranted downstream chain-check (done — see spot-check).
- **Recommendations** — none blocking.

## adversarial-read (full access, ARD SPEC §7) — VERDICT: APPROVED
Eight-job walk clean (checklist in `verification-checklist.md`): semantic chain (a) clean against installed source; (b) one comparative-superlative ("lowest-risk", §5) — fixed in spot-check; (c)/(d)/(e)/(f)/(h) clean; (g) one non-load-bearing mislabel in the F2 specialist brief ("fullscreen (portrait)" on video.css:575) — left in the within-specialist artifact, not carried into parent.md. `unreachable-source` lint flags correctly treated as sandbox-network artifacts.

## spot-check (lead, full substrate) — corrections in place
Verified the load-bearing values directly against the installed source (the fix depends on them):
- large overhang `margin-bottom:-16px` — video.css:71 (selector :68, no `:where()` → (0,3,0)) ✓
- small overhang `margin-top:-2.5px; margin-bottom:-6px` — video.css:457-458 (selector :455, `:where()`-wrapped → (0,0,0)) ✓
- fullscreen small reset `margin-bottom:0` — video.css:461 ✓
- small-vs-large threshold 576/380 and `:nth-last-child(2)`/`:last-child` group ordering ✓
Corrections applied to parent.md §5: removed the "lowest-risk" comparative; added the
`:where()`-specificity refinement (the small-layout overhang is zero-specificity, so the
override wins without `\!important`). lint floor across all artifacts: 0 unresolved-handle,
0 colliding-handle, 0 thin; the only flags were sandbox `unreachable-source` (web-doc URL
liveness) + version-number false-positives.

## Net
Full verification stack passed (lint floor + adversarial-read APPROVED + evaluate APPROVED + spot-check corrections applied). Output is durable + cited; the constrained-container fix is source-grounded and ready to apply to `live-player-control-bar-overflow`.
