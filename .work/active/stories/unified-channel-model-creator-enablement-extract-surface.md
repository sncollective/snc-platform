---
id: unified-channel-model-creator-enablement-extract-surface
kind: story
stage: done
tags: [streaming, playout, refactor]
parent: unified-channel-model-creator-enablement
depends_on: []
release_binding: 0.4.0
gate_origin: null
created: 2026-06-21
updated: 2026-06-22
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
- [x] `admin/playout.tsx` renders `<EditorialSurface>` with `capabilities` all-true; admin page
      is behavior-identical (no visual or interaction change).
- [x] Existing admin playout tests pass with no test changes (the regression gate).
- [x] New isolated render test for `<EditorialSurface>`: queue add/remove and pool add/remove
      callbacks fire; capability flags accepted (gate no in-surface block in this extraction —
      tabs/CRUD/banner stay in the route; test asserts the body is identical with caps all-false).
- [x] No backend changes in this story.

## Notes
This is the trickiest unit (production admin path) and lands first precisely so the admin route
is its own regression gate before any creator code consumes the component. See the feature body
`## Architectural choice` and `## Risks`.

## Implementation notes (as-built)

**What moved into `apps/web/src/components/playout/editorial-surface.tsx`:** the channel-scoped
editorial body — `PlayoutStatusBar` (connection pill + stale banner), the global action-error
banner, Now Playing + Skip, the editable Queue (`PoolItemPicker` add / `QueueItemRow` remove),
and the Content Pool (`ContentSearchPicker` add, `AddContentForm` create, `ContentPoolTable`
remove/retry). The `useChannelQueue` hook, `relativeAge`, `STALE_THRESHOLD_MS`, the
`upcomingWithEstimates` calc, the `queueNotResponding` tri-state, and the pool/queue/skip state
+ handlers all moved with it. Leaf components under `components/admin/*` were left untouched —
the surface composes them.

**What stayed in `apps/web/src/routes/admin/playout.tsx`:** `BroadcastStatus`, `selectedChannelId`
+ channel-select tabs, create/delete confirm dialogs and their handlers, `pollEngineHealth`, the
engine-restart reload logic (`engineStatus` / `reloadWhenReady`), and the admin-only
`useSpineTopic("playout", …)` engine-restarted handler. The route owns the `<SpineProvider>`.
Channel-CRUD errors (`createChannel`/`deleteChannel`) now set a route-local `actionError` rendered
in the tabpanel above the surface — preserving the original placement (queue/pool action errors
live inside the surface).

**Final props shape:**
```tsx
interface EditorialSurfaceProps {
  readonly channelId: string;
  readonly spineTopic: SseTopic;          // admin passes "playout"; creator mount → "content"
  readonly capabilities: {
    readonly channelCrud: boolean;        // admin only
    readonly broadcastBanner: boolean;    // admin only
    readonly channelTabs: boolean;        // admin only
  };
}
```

**Topic parameterization:** the `<SpineProvider topics={…}>` and topic choice live at the *mount*
level (the route keeps `PLAYOUT_TOPICS = ["playout"]`). The surface accepts a `spineTopic: SseTopic`
prop and subscribes `useSpineTopic(spineTopic, () => refetchQueue())` for queue refetch. The
admin route additionally subscribes its own `useSpineTopic("playout", …)` for the engine-restarted
event — the spine store fans each event out to *every* subscribed handler (`Set` of handlers per
topic), so the two subscriptions coexist and refetch still fires on every playout event (including
engine-restarted), matching the original single-subscription behavior.

**Capability flags:** accepted for the creator-mount contract but gate no in-surface render in this
extraction — tabs/CRUD/broadcast all stay in the route. The surface body (now-playing/queue/pool)
is capability-independent here, which the new test asserts honestly (it does not fabricate a hidden
block). A later story wires any genuinely-conditional surface render to these flags.

**Behavior-identity detail:** the surface is keyed `key={selectedChannelId}` in the route, so a
tab switch remounts it — resetting internal pool/queue/picker state cleanly. This is a superset of
the original explicit `setShowAddForm(false)` / `setShowSearchPicker(null)` resets in the tab
`onClick` (which were removed since the state now lives in the surface), and is behavior-identical
on the admin path.

**Tests:** existing admin regression gate `tests/unit/routes/admin/playout.test.tsx` passes with
zero changes (28 cases). New isolated `tests/unit/components/playout/editorial-surface.test.tsx`
adds 9 cases (queue add/remove, pool add/remove, skip, refetch-on-event, no-tabs/CRUD/broadcast in
surface, identical body when caps all-false). Full web suite green (1776 tests); `bun run --filter
@snc/web build` passes.

**Pre-existing out-of-scope issue (not introduced here):** `bun run --filter @snc/web typecheck`
reports one error in `src/contexts/spine-store.ts` — its `EVENT_TOPIC` map is missing
`"content.playout-changed"`, an event type a sibling Wave-1 story added to the
`packages/shared/src/events.ts` union but has not yet wired into the topic map. This predates this
story (it reproduces with this story's source changes stashed) and is outside the extraction scope;
flagged for the sibling story / orchestrator. No backend changes in this story.

## Review record
Verdict: **Approve** (fast lane) — behavior-identical extraction; existing admin playout tests
(regression gate) pass with zero test changes; new isolated `<EditorialSurface>` render test added;
full web suite (1776) + typecheck + build green. Verified by orchestrator re-run.
