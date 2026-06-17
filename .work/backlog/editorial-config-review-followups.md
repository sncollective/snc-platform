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

**✓ Items 4–6 RESOLVED** in the unified-model topology revision (2026-06-17).

4. **RESOLVED:** `topoSort` now receives the edge list built directly in `buildPlayoutTopology` at tier
   resolution time. No string-strip reverse-map. Unknown-source carry edges excluded from the edge list
   (they were already dropped at resolution) so Kahn's queue never blocks on a phantom dependency.
5. **RESOLVED:** `ValidationError` (typed `AppError` subclass) used everywhere plain `Error` was thrown.
6. **RESOLVED:** Unknown channel-as-source reference drops the carry tier + logs a warning (render
   continues with remaining tiers). FK cascade remains the primary guard; this is defense-in-depth.
