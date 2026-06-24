---
id: unified-channel-model-creator-enablement
kind: feature
stage: implementing
tags: [streaming, playout]
parent: unified-channel-model
depends_on: [unified-channel-model-identity-lifecycle, unified-channel-model-editorial-engine]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-24
---

# Creator editorial enablement — the surface mounts on creator manage

## Brief
Creators get the editorial surface for their own persistent channel: mount the shared
queue/pool/actions surface on creator manage, scoped to the creator's channel and
permissions; the lazy-provisioning UX (first channel-shaped act creates the channel —
stream key, pool config, queue use — with honest messaging about what just got created);
and the permission model (creator edits own channel's programming; platform roles edit
S/NC channels; nothing cross-creator).

**This feature mounts, it does not build, the surface.** The role-scoped editorial
components are `playout-admin-redesign`'s deliverables — its 2026-06-12 reframe commits
its children to "a channel + a permission context, not 'the admin screen'". This feature
consumes those components for the creator context. If sequencing inverts (this feature's
design pass arrives before the redesign children land usable components), STOP and
coordinate rather than building a parallel creator-only surface — a second editorial
surface is exactly what the unified epic exists to prevent.

Does NOT cover: the editorial engine semantics (sibling); admin-context surface work
(playout-admin-redesign); schedule tier (deferred by epic decision); discovery/viewer
presentation of creator channels (live-experience epic).

## Epic context
- Parent epic: `unified-channel-model`
- Position in epic: terminal child — needs `identity-lifecycle` (persistent channels,
  lazy provisioning semantics) and `editorial-engine` (the config it edits). Cross-epic
  coordination with `playout-admin-redesign` children by prose contract (no hard
  `depends_on` edge across epics; check their state at design time).

## Foundation references
- Epic body `## Decisions` — provisioning (lazy, on first use), control model
- `playout-admin-redesign` epic `## Reframe` — shared-surface commitment this feature consumes

## Design decisions (feature-design 2026-06-21, interactive)

Grounded against the landed code, not the brief's assumption. **Key correction:** the brief
assumed `playout-admin-redesign` left behind role-scoped editorial *components* this feature
would merely mount. It did not — the editorial surface is **route-bound inside
`apps/web/src/routes/admin/playout.tsx`** (773 lines: channel tabs, queue, pool, channel CRUD,
engine-restart UX, broadcast banner all inlined). Only the leaf components under
`components/admin/*` (`AddContentForm`, `ContentPoolTable`, `ContentSearchPicker`,
`PoolItemPicker`, `QueueItemRow`, `ProcessingStatusBadge`) are already pure, channel-scoped, and
reusable. So this feature **extracts first, then mounts** — it does not build a parallel surface
(per the brief's STOP condition, which tripped). User confirmed extract-first.

- **Backend gate: new `requireCreatorChannelPermission` middleware + shared handler logic.** The
  editorial routes (`/api/playout/channels/:channelId/*`) are all `requireRole("admin")` with no
  per-creator check. The editorial queue/pool *logic* is extracted into service-callable
  functions; both the existing admin routes and a new creator route surface call the same
  functions behind different gates — one logic path, two gates (no admin/creator divergence).
  The gate is a thin wrapper over the existing `requireCreatorPermission` *service* function
  (`services/creator-team.ts`) — editorial routes are keyed by `channelId` but creator permission
  is keyed by `creatorId`, so the middleware loads the channel, asserts
  `ownership === "creator"`, and checks `manageStreaming` on `channel.creatorId`. Rejected:
  extend admin routes with a dual `admin-OR-creator-permission` gate — fewer files but mingles
  admin and creator concerns on one route surface and risks the two diverging silently.
- **Channel resolution: dedicated `GET /api/creators/:creatorId/channel` endpoint + manage-loader
  fetch.** The persistent creator channel exists (lazy-provisioned by `ensureCreatorChannel`,
  `services/channels.ts`) but isn't on `CreatorProfileResponse` and has no web fetcher. New
  endpoint returns `{ channelId }` or `{ channelId: null }` (not provisioned yet). The manage
  layout loader fetches it; the Programming surface renders when present, shows a "set up
  streaming first" affordance when null. Rejected: add `persistentChannelId` to
  `CreatorProfileResponse` — simpler but leaks the channel id into every PUBLIC profile fetch,
  including unauthenticated viewers.
- **Mount: new "Programming" tab on creator manage, full surface.** A dedicated
  `manage/programming.tsx` nav item (the manage shell is the `ContextShell` sidebar pattern, not
  horizontal tabs). Surface = Now Playing + Skip, Queue (add/remove), Content Pool
  (add/create/search), manual/auto control. Creators are constrained to `live` + `queue` tiers
  (`editorial-config.ts:149` ownership guard) — so the surface is the admin one **minus** channel
  tabs, **minus** channel CRUD + engine-restart UX, **minus** broadcast banner, **minus** carry.
  Pool is present and auto-scoped to the creator's own content (`poolContentScope`). Rejected:
  inline into the existing Streaming tab (long mixed page); queue-only v1 (leaves the surface
  incomplete vs admin for no real saving — the pool/control are already built server-side).
- **Real-time: ride the existing `content` SSE topic, creator-scoped.** The `playout` topic is
  `admin`-access (`TOPIC_ACCESS`, `events.ts`) — a creator can't subscribe and it would leak
  all-channel events. The `content` topic is `authenticated` and **already does
  creator-membership scope filtering** (`sse.routes.ts:153-168` resolves the subscriber's
  `creatorIds`; the event bus filters by them). Creator editorial events are published scoped to
  the owning creator and ride `content`. No new topic vocabulary. The 3s queue poll inside
  `useChannelQueue` stays as the degraded fallback, exactly as admin uses it.
- **No carry for creator channels — and the reason is architectural, recorded so it isn't
  re-litigated.** S/NC TV's `channel-as-source` carry is **media-layer composition**: one
  continuous linear broadcast (single HLS output) that must *seamlessly* cut to a live creator and
  back within one stream (`fallback([live, queue, pool, blank])` with Liquidsoap `transitions`,
  `liquidsoap-render.ts:160-186` — "line 192 becomes the rule"). Creator-to-creator "hosting" is a
  **presentation re-point**: an offline creator's *page* embeds another creator's existing HLS
  player. That's a viewer-layer decision (the `live-experience` epic owns viewer presentation of
  creator channels), needs no Liquidsoap edge, and is the wrong job for media-layer carry. The
  guard relaxation is mechanically one line (`editorial-config.ts:149`; cycle detection + carry
  render are already ownership-agnostic), but the cost is product/safety (cross-creator cycles,
  carrying paywalled/non-consenting creators, moderation) — deferred deliberately. Filed as a
  `live-experience` backlog note for the presentation-re-point path. User confirmed: ship neither
  carry nor hosting here.

## Architectural choice

**Extract the route-bound editorial surface into a shared `<EditorialSurface>` component +
shared backend handler logic, then mount the component on creator manage behind a creator gate.**

Considered three approaches:
1. *Mount the admin route's components directly* — impossible: the surface is route-bound, not a
   component. This is the brief's now-falsified assumption.
2. *Build a creator-only editorial surface in parallel* — fastest to a creator screen, but it's
   exactly the second editorial surface the unified epic exists to dissolve. Rejected by the
   epic's mandate and the brief's STOP condition.
3. *Extract `<EditorialSurface channelId perms capabilities>` from `admin/playout.tsx`, re-point
   the admin route at it (behavior-identical), then mount it on creator manage* — chosen. One
   surface, two mount points, capability-gated (admin gets channel CRUD + broadcast banner +
   all-channel tabs via props the creator mount omits).

The extraction is the trickiest unit (it touches the production admin path and must stay
behavior-identical), so it's designed and landed first, with the admin route as its own
regression gate before the creator mount consumes it.

## Implementation Units

### Unit 1 — Extract `<EditorialSurface>` from the admin route (frontend)
**Story**: `unified-channel-model-creator-enablement-extract-surface`
**Files**: `apps/web/src/components/playout/editorial-surface.tsx` (new),
`apps/web/src/routes/admin/playout.tsx` (re-point), reuse `components/admin/*` leaf components.

Pull the queue + now-playing + content-pool + manual/auto-control body (currently
`PlayoutPageInner`, lines ~602-768) into a presentational `<EditorialSurface>` taking:

```tsx
interface EditorialSurfaceProps {
  readonly channelId: string;
  /** Capabilities the mount grants; creator mount omits CRUD/broadcast. */
  readonly capabilities: {
    readonly channelCrud: boolean;       // admin only
    readonly broadcastBanner: boolean;   // admin only
    readonly channelTabs: boolean;       // admin only (creator = single channel)
  };
  /** Spine topic to subscribe + poll fallback are internal. */
}
```

The channel-select tabs, create/delete dialogs, engine-restart reload logic, and
`BroadcastStatus` stay in the admin route (or render only when the capability is set). The
queue/pool/control body is what moves. `useChannelQueue` and `PlayoutStatusBar` move with it.

**Acceptance**: admin playout page is behavior-identical post-extraction (existing admin
playout tests stay green; no visual/interaction regression on the admin path).

### Unit 2 — Extract shared editorial handler logic + creator route surface (backend)
**Story**: `unified-channel-model-creator-enablement-api-gate`
**Files**: `apps/api/src/middleware/require-creator-channel-permission.ts` (new),
`apps/api/src/routes/creator-playout.routes.ts` (new), refactor of
`apps/api/src/routes/playout-channels.routes.ts` (extract handler bodies to shared fns).

Middleware:
```ts
/** Gate a channel-keyed editorial route by per-creator permission.
 *  Loads the channel, asserts ownership === "creator", then delegates to
 *  requireCreatorPermission(user, channel.creatorId, "manageStreaming"). */
export const requireCreatorChannelPermission: MiddlewareHandler<AuthEnv>
```
New routes mirror the admin editorial routes (queue GET/insert/remove/skip, content
GET/search/assign/remove) at `/api/creators/:creatorId/channels/:channelId/*`, gated by the new
middleware, calling the **same** extracted service functions the admin routes now call.
Creator routes expose **no** channel CRUD (no create/delete/engine-restart).

**Acceptance**: a creator team member with `manageStreaming` can drive their own channel's
queue/pool; a non-member / insufficient-role gets 403; a creator cannot touch another creator's
channel (cross-creator 403); admin routes unchanged.

### Unit 3 — Creator channel resolution endpoint (backend)
**Story**: `unified-channel-model-creator-enablement-channel-resolve`
**Files**: `apps/api/src/routes/creator.routes.ts` (add endpoint) or `creator-playout.routes.ts`,
web fetcher in `apps/web/src/lib/`.

`GET /api/creators/:creatorId/channel` → `{ channelId: string | null }` (null = not yet
provisioned). Authenticated; readable by creator team members (re-uses membership check).

**Acceptance**: returns the persistent channel id for a provisioned creator; null before first
stream-key/provisioning; not leaked on public profile fetches.

### Unit 4 — Mount Programming tab + provisioning UX (frontend)
**Story**: `unified-channel-model-creator-enablement-mount`
**Files**: `apps/web/src/routes/creators/$creatorId/manage/programming.tsx` (new), manage nav
registration in `manage.tsx`.

Add the "Programming" nav item (gated on `manageStreaming`). The route loader resolves the
creator channel id (Unit 3). When present, render `<EditorialSurface channelId capabilities={{
channelCrud: false, broadcastBanner: false, channelTabs: false }} />` wired to the `content`
spine topic. When null, render honest "set up streaming to start programming" guidance (links to
the existing Streaming tab where stream keys are created — first key triggers provisioning).

**Acceptance**: a creator owner sees their queue/pool/control on Programming, scoped to their
channel; a viewer-role member doesn't see the tab; pre-provisioning shows the setup affordance,
not an error.

## Implementation Order
1. Unit 1 — extract `<EditorialSurface>` (admin path is its own regression gate)
2. Unit 2 — backend gate + shared handlers; Unit 3 — channel resolution endpoint (parallel; both
   depend only on existing services)
3. Unit 4 — mount Programming tab (depends on Units 1, 2, 3)

## Testing
- **Unit 1**: existing admin playout tests are the regression guard — they must stay green with
  zero changes. Add a render test for `<EditorialSurface>` in isolation (queue add/remove, pool
  add/remove callbacks fire).
- **Unit 2**: route tests — happy path (member with `manageStreaming`), auth-failure (403
  non-member), cross-creator 403, ownership-mismatch (admin channel via creator route → 403/404).
  Mirror the admin route tests' shape against the new gate.
- **Unit 3**: provisioned → id; unprovisioned → null; non-member → 403.
- **Unit 4**: tab visibility by permission; surface renders when channel present; setup
  affordance when null. Fix-verify in the running app (platform convention: user re-confirms the
  creator can drive their channel's queue live).

## Risks
- **Extraction regression on the production admin path.** Mitigation: Unit 1 lands first with the
  admin route re-pointed and the existing admin tests as the gate, before any creator code exists.
- **Provisioning race** — a creator opens Programming before ever creating a stream key (no
  channel row). Handled by the null-channel affordance (Unit 4), not an error path.
- **Spine scope leak** — creator editorial events must be published scoped to the owning creator
  so the `content` topic's existing creator-membership filter contains them. Verify the publish
  carries the creatorId scope; a mis-scoped publish would broadcast one creator's queue events to
  others. Covered by an integration assertion in Unit 2.

## Real-time publish wire-up — WIRED (2026-06-22)
Unit 2 (api-gate) landed the `content.playout-changed` event schema, its `EVENT_REGISTRY`
scopeFilter on the `content` topic, AND the creator route surface. The publish callsites are now
wired as a small follow-on.

**What was done:** Added `findChannelCreatorId(channelId): Promise<string | null>` to
`apps/api/src/services/channels.ts` — reads `ownership` + `creatorId` from the channels table;
returns `creatorId` for `ownership='creator'` channels, `null` otherwise (platform/admin → skip).
Added a private `publishCreatorEditorialChange(channelId, changeType)` helper in
`apps/api/src/services/playout-queue-transitions.ts` that resolves the creatorId and emits
`content.playout-changed` conditionally — fire-and-forget, errors swallowed, never fails a
transition. Wired it at all 5 existing `eventBus.publish` callsites in that file:

| Callsite | Existing event | New event (creator channels only) |
|---|---|---|
| `markPlayed` | `playout.now-playing-changed` | `content.playout-changed` changeType=`now-playing` |
| `promoteNext` | `playout.now-playing-changed` | `content.playout-changed` changeType=`now-playing` |
| `enqueue` (on row) | `playout.queue-changed` | `content.playout-changed` changeType=`queue` |
| `enqueueBatch` (count>0) | `playout.queue-changed` | `content.playout-changed` changeType=`queue` |
| `removeQueued` (success) | `playout.queue-changed` | `content.playout-changed` changeType=`queue` |

Platform/admin channels: only the existing `playout.*` event fires — unchanged. The admin
real-time path is untouched. Tests assert creator→both events, platform→only `playout.*` for all
5 callsites. All 1853 API unit tests green.

## Children complete — advanced to review (orchestrated implementation, 2026-06-22)

All four child stories implemented, reviewed, and `done`:

| Story | Outcome |
|---|---|
| `extract-surface` | `<EditorialSurface>` extracted from `admin/playout.tsx`; admin route re-pointed, behavior-identical. Fast-lane Approve. |
| `api-gate` | Creator-scoped editorial API (`requireCreatorChannelPermission` + `/api/creator/playout/*` + SSE scopeFilter). **3 cross-model review rounds** — caught + fixed 2 cross-tenant content leaks (search/assign + queue-insert) and a fail-open scope. |
| `channel-resolve` | `GET /api/creators/:creatorId/channel` (handle-or-id, pure read, no public leak). Reopened once for handle resolution. |
| `mount` | Programming tab on creator manage; `<EditorialSurface>` data layer parameterized via `EditorialApi` context (admin + creator bundles). Reopened once (4 findings incl. the handle bug + create-path + route guard + context fail-close). |

**Implementation approach:** parallel Wave-1 (3 foundation stories), then Wave-2 (mount). Every
story got an agent implementation pass + verification; the security-bearing and integration-bearing
stories additionally got **cross-model (Codex) adversarial review**, which caught defects the
single-model pass and the green unit tests both missed — three cross-tenant paths on `api-gate` and
a feature-breaking handle-resolution bug spanning `channel-resolve`+`mount`. All fixed and
re-verified to convergence.

**Architecture delivered:** one editorial surface, two mounts (admin keeps channel CRUD / broadcast
/ all-channel tabs + the `playout` topic; creator gets queue+pool+control scoped to its own channel
via the `content` topic), one backend logic path behind two gates (admin `requireRole` / creator
per-creator `manageStreaming`), creator content pool strictly scoped to the creator's own content at
every entry point. Honors the unified epic's no-second-surface mandate.

**Verification:** full suite green — `@snc/shared` 675, `@snc/api` 115 files, `@snc/web` 167 files,
web typecheck + API build clean.

**Deferred (recorded, not blocking):**
- **Real-time publish wire-up** — DONE (2026-06-22). See the `## Real-time publish wire-up` section
  above for what was wired and tested.
- **Live fix-verify (AC#5)** — a creator driving their channel's queue in the running app. Code is
  correct + cross-model-reviewed; the running-app confirmation is a user step (platform fix-verify
  convention).

Closing this feature makes all four `unified-channel-model` epic features terminal — the epic (the
playout re-architecture's main arc) can close.

## Review findings (2026-06-24) — BOUNCED to implementing

**Verdict**: Request changes. Two blockers, both surfaced by the **cross-model (Codex) pass**,
both missed by the green unit suite + the same-model fresh-context reviewer. Feature returned to
`stage: implementing`. The doc-drift fixes from the first pass were correct and stand (not
reverted) — they are foundation rolling-forward, independent of these code fixes.

### Blocker B1 — creator-owned content cannot be queued or played (functional break)
The creator content pool's *primary purpose* — queue and play your own content — does not work:
- **Manual queue silently excludes creator content.** Creator-assigned content is stored as
  `channel_content` rows with `content_id` set and `playout_item_id: null` (the
  `sourceType === "content"` branch, `editorial-surface.tsx:237`). But `handlePlayNext`
  early-returns `if (!item.playoutItemId)` (`editorial-surface.tsx:220`) and the picker filters to
  `sourceType === "playout"` only (`pool-item-picker.tsx:66`). So a creator can assign their
  content to the pool but has no way to "play next" with it.
- **Auto-fill hits a non-deferred FK violation on creator content.** Auto-fill aliases
  `cc.content_id AS playout_item_id` (`playout-orchestrator.ts:776`) and feeds those values into
  `enqueueBatch` → `playout_queue.playout_item_id`, which is `.notNull().references(playoutItems.id)`
  (`playout-queue.schema.ts:60-62`). A `content.id` is not a `playout_items.id`, so the insert
  throws. A creator channel whose pool is all creator content can't auto-fill at all.

Root: `playout_queue` only models playout-item rows; creator content (`content` table) was added to
the *pool* but there's no path from a pooled `content_id` to a playable queue row. Fix options to
weigh at implement-design (don't pre-commit): (a) give creator content a playout-item projection so
it can ride the existing queue, or (b) widen the queue model to carry `content_id` (schema + FK +
transitions + Liquidsoap render). This needs feature-design judgment, not an inline patch.

Why the tests missed it: cross-tenant tests assert *isolation* (B's content stays out of A's pool),
not *function* (A's content actually plays); AC#5 live fix-verify (a creator driving their queue in
the running app) was deferred to the user and never ran.

### Blocker B2 — `listContent` is not creator-scoped (read-side tenant gap)
`listContent` (`playout-orchestrator.ts:655`) selects from `channel_content` filtered only by
`channel_id` — unlike `searchAvailableContent` / `assignContent` / `insertIntoQueue`, it does NOT
constrain the content branch to `c.creator_id = scope.creatorId` and does NOT exclude soft-deleted
content (`c.deleted_at IS NULL`). Today writes are scoped so the pool *should* only hold own content,
but the read relies entirely on every write path staying perfect forever, with no read-side guard.
Given this feature's leak history, the read must scope too (defense in depth). Fix: derive scope via
`resolvePoolScope` and add the `creator_id` + `deleted_at` filters to the content branch; add a
regression test that a stale/foreign `channel_content` row is NOT listed.

The same-model reviewer rationalized this as "safe by construction" — exactly the blind spot the
cross-model loop exists to catch.

### Verified SAFE (Codex concurred with the first-pass findings)
- **Gate** (`require-creator-channel-permission.ts`): authorization is sound — loads channel by
  `:channelId`, requires creator-ownership + non-null creatorId + `live-ingest` role, keys
  permission on the channel's own creatorId. (Nit: cross-creator denial is 403 vs 404 for
  nonexistent, so creator-channel existence is distinguishable — low-severity, note only.)
- **SSE scope** (`playout-queue-transitions.ts` + `event-bus.ts` + `channels.ts`): publish carries
  the owning creatorId; platform/admin channels emit no new creator event; subscriber filter keys on
  `event.creatorId`.
- **Admin extraction identity** (`admin/playout.tsx`): admin keeps broadcast status, channel tabs,
  channel CRUD, engine-restart, `ADMIN_EDITORIAL_API`, `spineTopic="playout"`; creator mount uses
  `CREATOR_EDITORIAL_API` + `spineTopic="content"`. Behavior-identical on the admin path.

### Loop status
Cross-model peer-review loop pass 1 of ≤5 (peeragent → Codex, job 20260624T225104Z).

**B2 — RESOLVED (2026-06-24).** `listContent` now derives scope via `resolvePoolScope` and applies
the creator `creator_id` + `deleted_at IS NULL` filters to the content branch (suppressing the
platform playout branch for creator channels, matching `searchAvailableContent`). Regression test
**G8** added to `tests/integration/creator-playout/cross-tenant-isolation.test.ts` — pollutes
`channel_content` DIRECTLY (bypassing the scoped write) with a foreign creator's content, a platform
playout item, and a soft-deleted own row, then asserts `listContent` lists ONLY A's own active row.
All 11 cross-tenant integration tests green.

**B1 — ROUTED TO DESIGN.** The creator-content-unplayable gap is a design fork with schema
implications, not an inline patch. Scoped as a new child story `…-creator-content-playable` at
`stage: drafting` for `/agile-workflow:feature-design` to weigh: (a) project creator `content` into
a `playout_item` so it rides the existing queue model, vs (b) widen the queue model to carry
`content_id` (schema + FK + `playout-queue-transitions` + Liquidsoap render). No position committed
pre-design (substrate-before-stance). Feature stays at `implementing` and the parent epic cannot
close until B1 lands.

Next: feature-design B1 → implement → re-dispatch Codex for pass 2 on the full fix set.
