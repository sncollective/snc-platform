---
id: unified-channel-model-creator-content-playable-transitions
kind: story
stage: implementing
tags: [streaming, playout]
parent: unified-channel-model-creator-content-playable
depends_on: [unified-channel-model-creator-content-playable-schema]
release_binding: null
gate_origin: null
created: 2026-06-24
updated: 2026-06-24
---

# Make the queue transitions source-polymorphic

Unit 2 of `unified-channel-model-creator-content-playable`. Depends on the schema widening.

## Scope
**File**: `apps/api/src/services/playout-queue-transitions.ts`.

`enqueue`, `enqueueBatch` (and the `markPlayed`/`promoteNext` paths as needed) currently take
`playoutItemId: string`. Change the source param to a discriminated union and write the correct
column:

```ts
type QueueSource = { playoutItemId: string } | { contentId: string };
// enqueue({ channelId, source: QueueSource, position? })
// enqueueBatch(channelId, sources: QueueSource[])
```

Insert `playoutItemId` OR `contentId` per the source — the DB CHECK (Unit 1) enforces exactly-one.
The five `eventBus.publish` callsites and the `content.playout-changed` creator-scoping (already
landed in api-gate) are unchanged.

## Acceptance
- [ ] `enqueue` / `enqueueBatch` accept a content source and write a `content_id` row with `playout_item_id` null.
- [ ] The admin playout-item path is unchanged (writes `playout_item_id`, `content_id` null).
- [ ] The CHECK is never violated by any transition.
- [ ] Existing transition unit tests stay green; new tests cover the content-source branch.
