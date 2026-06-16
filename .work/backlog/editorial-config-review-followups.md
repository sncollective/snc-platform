---
id: editorial-config-review-followups
kind: backlog
tags: [streaming, playout, tests]
created: 2026-06-16
---

# Editorial-config review follow-ups (from config-schema review)

Non-blocking Important findings from the review of
`unified-channel-model-editorial-engine-config-schema` (Approve with comments, 2026-06-16). None
block the editorial-engine chain; fold into the relevant downstream story or drain as a small pass.

1. **`deleteEditorialConfig` doc comment overclaims a cascade that doesn't exist.** The comment says
   "and all its tiers via cascade", but `channel_editorial_tiers.channelId` FKs to `channels.id`
   (not to the config row), so deleting the config row leaves the channel's tiers in place. Deleting
   the *channel* cleans both (both cascade from `channels`); deleting only the config orphans tiers
   (config gone, tiers linger — and `getAllEditorialConfigs` then silently drops them since it maps
   over configs). Fix: either correct the comment to state the real behavior, or have
   `deleteEditorialConfig` explicitly delete the channel's tiers too. Decide the intended semantics.

2. **`updateEditorialTier` has no unit test.** It's the most complex write path (merges current+new,
   filters the tier's prior carry edge, re-runs cycle detection) yet is uncovered — `createEditorialTier`
   is tested but `update` is not. Add coverage: priority change, tierType change that adds/removes a
   carry edge, the cycle-rejection path, and the source-constraint validation on update. Naturally
   folds into the control-service story (Unit 5) which exercises tier mutation, or drain standalone.

3. **`upsertEditorialConfig` doesn't validate `manualTierId` belongs to the same channel.** The FK
   guarantees it points at *some* tier, not at one of *this* channel's tiers — so a config could pin
   another channel's tier, which the render/control plane would mis-resolve. Validate same-channel
   ownership when manual-pin is wired (control-service story is the natural home).

Source: review of config-schema; full code at `apps/api/src/services/editorial-config.ts` +
`apps/api/src/db/schema/editorial.schema.ts`.

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
