# channel-derived-pool-scope-query-guard

Derive content-pool scope from the channel row, then apply creator/platform filtering on every read/write path.

## When to use
Creator and platform channels share queue/pool machinery, but creator playback must never serve/queue foreign content. Scope derived from durable channel ownership, not caller input.

## Instances
- `apps/api/src/services/playout/content-pool.ts:30,34,131,136,159,223,228,249` — assignment/list/search apply branch suppression + creator ownership filter.
- `apps/api/src/services/playout/auto-fill.ts:43,51,70` — auto-fill uses channel scope.
- `apps/api/src/services/playout/queue-control.ts:85,92` — queue insert checks source in scoped pool.
- `apps/api/src/services/editorial-control.ts:233,244,249` — pool-next reapplies read-side tenant guard.

## Anti-patterns
Don't accept creatorId/tenant scope from the request body; don't guard writes only (re-check on read/playback); don't let creator-scoped queries include platform branches by omission.
