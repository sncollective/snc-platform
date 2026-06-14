---
slug: vidstack-layout-behavior
date: 2026-06-14
engagement: campaign (multi-specialist, standalone-heavy)
---

# Dispatch registration — Vidstack v1.12.13 layout/sizing/control-positioning behavior

## Dials (settled with operator at kickoff, 2026-06-14)
- **scope_authority**: mixed — 4 declared seed questions (coverage skeleton) + emergent specialist split (confirmed at Checkpoint A).
- **verification_rigor**: full — lint + adversarial-read + evaluate (isolated) + spot-check. Grounds production streaming-player UI.
- **intent**: behavioral reference for Vidstack v1.12.13 layout/sizing/control-positioning; grounds the `live-player-control-bar-overflow` fix + future Vidstack work.
- **output_kind**: cited campaign reference → feeds the `vidstack-v1` skill; plus the concrete fix technique for the open story.
- **engagement-unit**: per-source (installed Vidstack source files + official docs pages).
- **disconfirmation-mode**: derived (mixed) — seek-disconfirming per facet.
- **fan-out**: 3 specialists.

## Seed
Vidstack v1.12.13 (@vidstack/react, pinned) runtime layout/control behavior NOT captured by the API-reference skill. A fix on `live-player-control-bar-overflow` failed for lack of this. Observed: base.css `[data-view-type=video]{aspect-ratio:16/9}` flips to `aspect-ratio:inherit` on `[data-started]:not([data-controls])`; bottom controls group carries negative offset → LIVE/fullscreen bar sits at/below the 16:9 edge; app wrappers with aspect-ratio+overflow:hidden clip it.

## Primary-source posture
Installed code (`node_modules/.bun/@vidstack+react@1.12.13+b2e33729a97476bf/node_modules/@vidstack/react/`) is authoritative for the pinned version's behavior; official docs (vidstack.io) give the intended model + supported customization. Both attested.

## Decomposition (3 facets)
- **F1 player-box-sizing** — aspect-ratio handling, the started-without-controls `inherit` rule, smallLayoutWhen threshold, how the player establishes height.
- **F2 control-layout-positioning** — DefaultVideoLayout structure, control-group offsets, overlay-vs-flow, small[data-sm] vs large, stable styling API (CSS vars / ::part / .vds-* public vs internal).
- **F3 intended-model-embedding** — official docs: supported sizing/embedding in fixed-aspect/overflow:hidden/rounded containers + control-position customization; cross-checked against F1/F2.

## Substrate-check
Existing `.research/analysis/positions/vidstack-media-player.md` + `briefs/media-player-libraries.md` are SELECTION rationale (Vidstack vs alternatives) — no overlap with this layout/control-behavior engagement.
