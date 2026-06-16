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
