---
id: feature-flags-production-defaults-drift
kind: story
stage: drafting
tags: [bug, testing, documentation]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-26
updated: 2026-06-26
---

# Bug: PRODUCTION_DEFAULTS preset referenced but never exported; e2e hard-codes its own flags

## Brief

Doc/source drift surfaced by the adversarial e2e review (Codex), verified against source:

- `docs/feature-flags.md` claims `packages/shared/src/features.ts` exports **two** presets,
  `ALL_FEATURES_ON` and **`PRODUCTION_DEFAULTS`** (lines 9, 38, 62–63, 73), and instructs adding
  new flags "to both presets."
- `packages/shared/src/features.ts` exports **only `ALL_FEATURES_ON`** — there is no
  `PRODUCTION_DEFAULTS` preset. The doc is wrong, and any agent following it ("add to both
  presets") would hit a missing symbol.
- The e2e suite does **not** consume a shared preset at all — `apps/e2e/playwright.config.ts:13`
  hard-codes its own `PROD_FLAGS` dict. So the "staging mirrors prod flags" fidelity claim rests
  on a **hand-maintained copy** that can silently drift from prod's real flag posture.

## Why it matters

The `machine-verifiable-testing` epic leans on e2e being a trustworthy rung — "staging mirrors
prod" is part of what makes a green e2e suite a valid close. A hand-copied flag dict that's
already documented-but-not-real undercuts that.

## Fix direction (confirm at design)

Two coherent options — pick one:

1. **Add the real `PRODUCTION_DEFAULTS` preset** to `features.ts` (the doc already describes its
   intent: every flag at its intended production state), and have `playwright.config.ts` derive
   `PROD_FLAGS` from it instead of hard-coding. Doc becomes true; e2e flags track a single source.
2. **If prod-defaults genuinely shouldn't live in shared**, fix the doc to match source (drop the
   `PRODUCTION_DEFAULTS` references, document where prod flag posture actually lives) and decide
   whether e2e should derive from that real source.

Option 1 is preferred — it makes the staging-fidelity claim structural rather than aspirational —
but the fix must verify what production *actually* sets per flag before codifying a preset
(substrate before stance: don't codify a `PRODUCTION_DEFAULTS` table from the doc's wishful
description without confirming the real per-flag prod state).

## Acceptance

- `docs/feature-flags.md` and `packages/shared/src/features.ts` agree on which presets exist.
- The e2e flag posture derives from a real shared source (or the doc accurately states why it
  doesn't), so "staging mirrors prod flags" is verifiable, not hand-copied.
- Unit coverage for the preset if one is added.

## Provenance

Adversarial e2e architecture review — Codex, 2026-06-26 (finding #8). Verified:
`grep PRODUCTION_DEFAULTS packages/shared/src/features.ts` returns nothing;
`docs/feature-flags.md:9` asserts it exists.
