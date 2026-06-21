---
id: unified-channel-model-creator-enablement-extract-surface
kind: story
stage: implementing
tags: [streaming, playout, refactor]
parent: unified-channel-model-creator-enablement
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-21
updated: 2026-06-21
---

# Extract `<EditorialSurface>` from the admin playout route

## Scope
Pull the queue + now-playing + content-pool + manual/auto-control body out of
`apps/web/src/routes/admin/playout.tsx` (currently inlined in `PlayoutPageInner`, ~lines
602-768) into a presentational `apps/web/src/components/playout/editorial-surface.tsx`, then
re-point the admin route at it. **Behavior-identical on the admin path** — this is a pure
extraction, the admin playout page must look and behave exactly as before.

The leaf components under `components/admin/*` (`AddContentForm`, `ContentPoolTable`,
`ContentSearchPicker`, `PoolItemPicker`, `QueueItemRow`, `ProcessingStatusBadge`) are already
pure and reusable — keep them as-is, the surface composes them. `useChannelQueue` and
`PlayoutStatusBar` move into / alongside the new component.

## Unit (feature Unit 1)
`<EditorialSurface>` takes:
```tsx
interface EditorialSurfaceProps {
  readonly channelId: string;
  readonly capabilities: {
    readonly channelCrud: boolean;       // admin only
    readonly broadcastBanner: boolean;   // admin only
    readonly channelTabs: boolean;       // admin only (creator = single channel)
  };
}
```
What **stays in the admin route** (or renders only when its capability flag is set): channel
tabs, create/delete confirm dialogs, engine-restart reload logic, `BroadcastStatus`. What
**moves into the component**: Now Playing + Skip, Queue (add/remove via `PoolItemPicker`),
Content Pool (add/create/search), the queue-status hook + status bar.

The spine subscription is parameterized so the creator mount (Unit 4) can pass the `content`
topic while admin keeps `playout`.

## Acceptance criteria
- [ ] `admin/playout.tsx` renders `<EditorialSurface>` with `capabilities` all-true; admin page
      is behavior-identical (no visual or interaction change).
- [ ] Existing admin playout tests pass with no test changes (the regression gate).
- [ ] New isolated render test for `<EditorialSurface>`: queue add/remove and pool add/remove
      callbacks fire; capability flags hide CRUD/tabs/banner when false.
- [ ] No backend changes in this story.

## Notes
This is the trickiest unit (production admin path) and lands first precisely so the admin route
is its own regression gate before any creator code consumes the component. See the feature body
`## Architectural choice` and `## Risks`.
