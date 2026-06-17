---
id: editorial-config-review-followups
kind: backlog
tags: [streaming, playout, tests]
created: 2026-06-16
---

# Editorial-config review follow-ups (from config-schema review)

**✓ Items 1–3 (config-schema review) RESOLVED** in the config-schema unified-model revision
(2026-06-17): (1) `deleteEditorialConfig` comment corrected to state the real no-cascade semantics
(config-only delete; `deleteChannel` for full cleanup); (2) `updateEditorialTier` now has 7 unit tests;
(3) `upsertEditorialConfig` now validates `manualTierId` belongs to the same channel. Left here struck-
through for the record; only the topology items below remain open.

## From topology review (2026-06-16)

Non-blocking Important findings from the review of `unified-channel-model-editorial-engine-topology`
(Approve with comments). Code works correctly for the current UUID-shaped channel ids; goldens stayed
byte-identical; 1683 tests pass. All in `apps/api/src/services/playout-topology.ts`.

4. **`topoSort` reverse-maps `sourceLiqVar → channelId` unnecessarily.** `buildPlayoutTopology` already
   has the `(channelId → sourceChannelId)` edge directly from the config when it resolves tiers
   (~line 316), but `topoSort` reconstructs it by string-stripping the rendered `ch_<uuid>_source` var
   (regex undo of `liqId`). Correct for UUID ids (hex+hyphens, no underscore ambiguity) but a fragile
   round-trip that breaks for non-UUID ids (the worker flagged this too). Refactor: build the edge list
   in `buildPlayoutTopology` and pass it to `topoSort`, rather than reverse-engineering it.
5. **Plain `Error` thrown in 4 places** (`resolveEditorialTier` ×2, `resolveSourceVar`, `topoSort`) —
   violates the AGENTS.md "typed `AppError` subclasses, never plain `Error`" convention. Use a typed
   error even on these should-never-fire build-invariant paths.
6. **`resolveSourceVar` throwing on an unknown referenced channel fails the ENTIRE render** (all
   channels), not just the misconfigured one — one dangling carry reference takes down playout. The FK
   cascade mostly prevents dangling refs, but consider dropping the bad tier + warn vs failing the whole
   build. Related: `liquidsoap-config.ts` already chose to degrade editorial-config *fetch* failures to
   queue-only + warn — decide whether the render should fail-loud or degrade once it consumes tiers
   (natural home: the render or control-service story).
