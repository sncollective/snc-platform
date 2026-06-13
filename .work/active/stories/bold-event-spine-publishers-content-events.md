---
id: bold-event-spine-publishers-content-events
kind: story
stage: implementing
tags: [streaming, media]
release_binding: null
depends_on: [bold-event-spine-publishers-queue-events]
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: bold-event-spine-publishers
---

# Content processing publisher + scope filter

Unit 3 of the parent feature design (incl. the chokepoint + team-aware filter
rationale).

## Scope

- Shared union: `content.processing-status-changed {contentId, creatorId, status}`
  (hint payload — client re-fetches).
- `updateContentProcessing`: publish only when `updates.processingStatus` is present,
  using `.returning({creatorId, processingStatus})` on the same UPDATE. Playout-item
  processing (`playout-ingest.ts`) is out of scope.
- `SubscriberContext` gains `creatorIds: string[]`; SSE route fills it at connect via
  one `creator_members` query (skipped when the `content` topic isn't granted).
- Registry entry: topic `content`, coalesce `contentId`, scopeFilter admin-or-member —
  this discharges the registry fence the endpoint feature established.

## Acceptance criteria

- [ ] Status-bearing update publishes; codec-only update does NOT.
- [ ] scopeFilter matrix: member sees own-creator events, not others'; admin sees all;
      anon never granted `content`.
- [ ] Existing event-bus + sse.routes tests green (additive ctx extension).
