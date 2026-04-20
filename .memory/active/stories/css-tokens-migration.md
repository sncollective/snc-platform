---
id: story-css-tokens-migration
kind: story
stage: done
tags: [design-system, refactor]
release_binding: 0.2.1
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# CSS Tokens Migration

Migrate hardcoded CSS values to design tokens — defined `--space-2xs`, `--color-{accent,secondary}-subtle`, `--color-overlay-dark`, `--z-raised`; fixed stale `--space-{1,2,3,half,2xs}` refs (8 files); replaced 0.1-opacity brand-color rgba literals with existing `--color-*-bg` tokens (10 sites); replaced 0.15-opacity rgba with new `-subtle` tokens (4 sites); tokenized z-index for base/raised/dropdown tiers. Remaining 0.2/0.25/0.3 rgba literals and nav/menu z-stacking semantics flagged as follow-ups (see comment in `elevation.css`).
