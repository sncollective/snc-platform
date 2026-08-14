---
id: r2-dark-value-swap
kind: story
stage: done
tags: [design-system]
parent: null
depends_on: []
release_binding: null
gate_origin: org R2 delta (principal-settled, pending stakeholder), 2026-08-14
created: 2026-08-14
updated: 2026-08-14
---

# R2 dark value swap (cast60 spine + glow gold)

## Applied (one-seam turn, all via token files)

- **Spine cast60** (dark + fallback; light holds warm paper pending papyrus spec): bg
  #171929 / elevated #21253A / surface #1D2036 / border #313551 / text-muted #979BAC.
  Nav scrim auto-follows (token-derived). bg-input untouched (not in org's spec — flagged).
- **Glow gold parent family** (dark + fallback): accent #F5A623 / hover #DE9012 /
  on-accent #2A1603 / accent-bg rgba(245,166,35,.14) / subtle .2. selected-bg follows the
  glow tint (12% recipe). Light accent unchanged (#A94900 — gold can't pass on paper).
- **Warning cascade:** dark #E3C832 (bg #342F21 unchanged); light #7D6E00 on #EFEBD0.
- **Chart-gold retune:** dark #E8C24A → #CFA23E (harness-gated: OKLab dE from warn-yellow
  ≥.08 — verified by the gate; light chart-gold unchanged).
- Harness seed pins updated to the R2 dark tuple.

## Flag-back resolution (org, 2026-08-14)

- **Light warning:** org OWNED the mislabel ("my line read 4.26-on-tint / 4.55-on-paper; I
  labeled the pair AA pass; the tint half fails"). ACCEPTED platform's #756B00 — swapped;
  the 4.2 harness carve REMOVED with it (no soft-floor precedent survives). Floor 4.5, clean.
- **bg-input:** #242E3C matched the reference (gap was org's — no cast60 mapping specced).
  Cast60 value #262A46 (input sits ~1.10 above elevated, violet-cast) — applied dark + fallback.

## Verification

Full web suite green; build green; separation anchors all pass the .05 floor (incl. glow vs
warn-yellow and chart-gold vs warn at the stricter .08 class gate).
