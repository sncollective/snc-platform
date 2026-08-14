---
id: accent-bg-consumer-recipe-alignment
kind: story
stage: backlog
tags: [design-system]
parent: null
depends_on: []
release_binding: null
gate_origin: review 2026-08-14 brand-token-architecture (residual of FIX 1)
created: 2026-08-14
---

# Accent-bg consumer recipe alignment

## Finding

Text-bearing `--color-accent-bg` consumers remain in creator, calendar, landing, library,
notifications surfaces and `press-image-picker.module.css` — not re-paired to the published
STATE/IDENTITY recipe during the brand-token-architecture review cycle because they sat
outside the corrective worker's exclusive write set.

## Current risk (post org value fix)

**Not a contrast bug anymore.** Org fixed the dark Parent `--voice-parent-accent-bg` omission
(reference f67db14e; platform re-seeded) — the accent-on-accent-bg composite now passes AA in
both modes (dark 6.13:1 on bg / 5.30:1 on elevated per org's matrix; light ~7.9:1). The
residual is **convention alignment**: the published recipe (`.claude/rules/platform-patterns.md`)
pairs accent identity text with `--color-selected-bg` + a structural cue rather than
accent-bg, and `context-shell` active nav already migrated as the reference shape.

## Work

Sweep the named surfaces; re-pair text-bearing accent-bg uses to the recipe (accent text +
selected-bg composite + structural cue) or justify per-surface retention; extend the
consumer-pairing contrast fixtures to cover them. Ride along with any feature touching these
surfaces rather than a dedicated stride.
