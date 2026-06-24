---
id: unified-channel-model-creator-content-playable-ui
kind: story
stage: implementing
tags: [streaming, playout]
parent: unified-channel-model-creator-content-playable
depends_on: [unified-channel-model-creator-content-playable-reads, unified-channel-model-creator-content-playable-transitions]
release_binding: null
gate_origin: null
created: 2026-06-24
updated: 2026-06-24
---

# Unblock the manual-queue UI for creator content

Unit 4 of `unified-channel-model-creator-content-playable`. Depends on the backend reads + transitions.

## Scope
**Files**: `apps/web/src/components/playout/editorial-surface.tsx`,
`apps/web/src/components/admin/pool-item-picker.tsx`, the creator playout insert route
(`apps/api/src/routes/creator-playout.routes.ts`) + admin equivalent + the web client lib.

- `pool-item-picker.tsx:66`: drop the `sourceType === "playout"` filter — content is now queueable.
- `editorial-surface.tsx` `handlePlayNext` (~line 220): stop early-returning on `!item.playoutItemId`;
  send the right source (`contentId` for content rows, `playoutItemId` for playout rows).
- Insert route validators (creator + admin): accept a discriminated `{ playoutItemId } | { contentId }`
  body; thread the source through to `orchestrator.insertIntoQueue`.

## Acceptance
- [ ] A creator selects their own pooled content in the queue picker and "play next" works.
- [ ] Admin can still queue playout items unchanged.
- [ ] **AC#5 live fix-verify** (the deferred one): user confirms a creator driving their own queue
      with their own content in the running app. Closes the deferred fix-verify for the whole
      creator-enablement arc.
