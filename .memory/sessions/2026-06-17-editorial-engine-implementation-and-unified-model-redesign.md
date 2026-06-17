---
date: 2026-06-17
tags: [streaming, playout, liquidsoap, editorial-engine, implement, review]
session_type: editorial-engine implementation → unified program-source redesign → 2 deep reviews → B1 downgrade → typecheck fix
related_items:
  - unified-channel-model-editorial-engine
  - research-handoff-liquidsoap-version-capability-audit-1
---

# Session: editorial-engine implementation + unified program-source redesign

Picked up from the 2026-06-16 editorial-engine spike note. Landed the LS upgrade, designed + implemented
the whole editorial engine (5-story chain), reframed the editorial model mid-stream, and ran two
fresh-context deep reviews that caught real bugs the per-story reviews missed. The feature is
**code-complete + green (tsc/tests/`--check`), held at `review` pending one operator gate: the staging walk.**

## 1. LS 2.4.5 upgrade landed (code; staging-pending)
`research-handoff-liquidsoap-version-capability-audit-1` — one-line Dockerfile pin `v2.4.2 → v2.4.5`,
step-1 greps clean. Implemented + at `review`; rebuild + staging-verify + ship are operator-at-station
(held, not done). Pairs with the `pin-docker-compose-image-versions` deploy story.

## 2. Editorial-engine design + the 5-story chain
Designed `unified-channel-model-editorial-engine` (feature-design) into a deliberate dependency chain:
**config-schema → topology → render → control-client → control-service**. Two forks resolved with the
user: **bespoke harbor endpoints** (not `interactive.harbor` — it only covers scalar sets, ops + introspection
stay bespoke) and **normalized relational config storage** (not JSONB — real FKs for channel-as-source
cycle/cascade). Drove it with the implement-orchestrator, gating each link with a review pass.

## 3. The unified program-source redesign (the big shift)
Reviewing the render surfaced an auto-mode-semantics fork; the user reframed the whole model:
**queue and pool are ONE continuous program source, not sibling switch tiers.** The operator queue
auto-fills from a pool when uncurated. This dissolved the ambiguity and simplified the taxonomy:
- `tierType` dropped `pool` → `live | queue | channel-as-source`; added per-source `enabled`.
- **auto = readiness fallback over enabled sources** (the line-192 generalization, self-running);
  queue = `fallback(track_sensitive=true, [operator_queue, pool])`; pool = LRP `request.dynamic` → a
  `pool/next` API callback.
- per-channel constraints: creator = own source only; admin = stream-key XOR channel-as-source.
- Reopened + re-walked config-schema → topology → render. (Substrate-before-stance caught in the act:
  the schema had calcified a tier taxonomy before the model was settled; the gated chain surfaced it
  before control-* built on it.)

## 4. Two fresh-context deep reviews caught what per-story reviews missed
The load-bearing process lesson of the session. Five per-story reviews (mine included) approved every unit,
yet a fresh-context **feature-level** review found seam + runtime bugs:
- **Deep review #1** → Request changes: **B1** live mode-flip/manual-pin were no-ops (the rendered switch
  never read the `mode`/`manual` refs the harbor endpoints mutated — tests asserted "client called," not
  "switch consumes ref"); **B2** manual-tier index-space mismatch → silence; **I1** docs/streaming.md drift;
  **I2** per-channel `live` tier port-1936 listener collision.
- Operator decided **B1 = downgrade**: mode/manual apply via **regenerate-restart**, only **arm/take** stays
  live. Removed the dead refs/endpoints/client verbs; verbs persist + `regenerateAndRestart`.
- **Re-review** → Approve w/ comments: downgrade correct + complete (traced end-to-end). Caught a
  **typecheck-gate failure** (42 `tsc --noEmit` errors, incl. 1 real src — the new `selected` field broke
  the legacy broadcast `getNowPlaying`) that the green vitest suite masked (vitest transpiles without
  typechecking). Fixed → tsc green.

## 5. Settled positions (durable)
- **Editorial control model (THE model):** one program source per channel (operator queue + pool auto-fill);
  `mode` (manual|auto), off = `channels.isActive`. **auto = readiness fallback over enabled sources;
  mode + manual-pin = regenerate-restart; arm/take = the only live verb.** Recorded in the feature body
  §Architectural choice; the spike position (`editorial-engine-switching-mechanism.md`) carries a
  breadcrumb that the engine deferred live mode/manual.
- **Pool scope (MVP):** curated per-channel `channel_content` (LRP, `channelId`-bounded). The ownership-scoped
  auto-draw (creator→own, admin→all-creators) is deferred with the admin-content/hidden-creator work
  (admin content = a hidden/system creator; its content flows into admin pools for free once it exists).

## 6. Process learnings
- **Fresh-context feature review earns its keep.** Per-story reviews verify units; only an end-to-end
  seam/runtime review catches composition bugs (B1/B2) and gate failures. Run one before a feature closes.
- **Green unit tests ≠ green build.** Vitest transpiles without typechecking, and a render-golden *string*
  test can't catch invalid Liquidsoap or dead refs. → filed: wire `tsc --noEmit` + `liquidsoap --check`
  into the gate (`editorial-render-followups` #2).
- **Submodule-detach hazard:** an IDE/tooling submodule-sync rewound platform to the parent pointer
  (`ca6111a`, detached HEAD) mid-session — work was safe on `main` and restored, but commits made while
  detached would orphan. Avoid `git submodule update`/IDE sync on platform while committing here.

## 7. State + pending
- **Feature at `review`, all 5 children `done`.** tsc + 1762 unit tests + `liquidsoap --check` green.
  Reviewed twice fresh-context. **17 commits ahead of `forgejo/main`, not pushed, submodule pointer not
  bumped** (operator's calls).
- **One gate to `done`: the end-to-end staging walk** on a real pipeline (operator-at-station) —
  mode/manual-after-restart, arm/take live, LRP rotation, the regenerate-restart cycle. Runtime behavior
  unit tests + `--check` structurally can't validate it.
- **Backlog (non-blocking):** `editorial-render-followups` (#1 multi-tier render untested; #2 wire
  tsc+`--check` into the gate; #3 `null()`→`null`; #4 `PoolScope` SSOT dup; #5 pool ownership-scope; #6
  manual-pin/live-exclusion index — latent until tier-creation lands). `editorial-docs-streaming-drift`
  (foundation-doc roll-forward / `gate-docs`). `editorial-config-review-followups` (resolved).
- **Next moves:** the staging walk (+ the LS 2.4.5 / image-pin staging verifies); then `snctv-composition`
  (re-express S/NC TV on the engine — the output-equivalence gate + the next epic child).
