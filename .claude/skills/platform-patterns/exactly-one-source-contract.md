# exactly-one-source-contract

Mirror "exactly one source" invariants through shared API schema, service union, and DB check constraint.

## When to use
Use when a row/action may reference one of multiple source kinds, but never zero or more than one.

## Instances
- `packages/shared/src/playout-queue.ts:124` — `QueueInsertSource` union models either `playoutItemId` or `contentId`.
- `packages/shared/src/playout-queue.ts:134` — `InsertQueueSourceSchema` refines optional fields to exactly one.
- `apps/api/src/services/playout-queue-transitions.ts:31` — service-layer `QueueSource` union mirrors the same two cases.
- `apps/api/src/db/schema/playout-queue.schema.ts:79` — DB `playout_queue_one_source` check enforces `num_nonnulls(...) = 1`.

## Canonical sketch
```ts
export type Source = { aId: string } | { bId: string };
export const SourceSchema = z.object({
  aId: z.string().optional(),
  bId: z.string().optional(),
}).refine((d) => Number(d.aId !== undefined) + Number(d.bId !== undefined) === 1);
check("table_one_source", sql`num_nonnulls(a_id, b_id) = 1`);
```

## Anti-patterns
Don't rely only on TypeScript for persisted data; don't accept `{ aId, bId }` and "pick one" silently.
