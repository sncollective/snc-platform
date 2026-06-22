---
id: unified-channel-model-creator-enablement-mount
kind: story
stage: review
tags: [streaming, playout]
parent: unified-channel-model-creator-enablement
depends_on: [unified-channel-model-creator-enablement-extract-surface, unified-channel-model-creator-enablement-api-gate, unified-channel-model-creator-enablement-channel-resolve]
release_binding: null
gate_origin: null
created: 2026-06-21
updated: 2026-06-22
---

# Mount the Programming tab on creator manage + provisioning UX

## Scope
Mount the extracted `<EditorialSurface>` (extract-surface story) on a new "Programming" tab in
creator manage, wired to the creator editorial routes (api-gate story) and the creator channel
resolution endpoint (channel-resolve story). Plus the lazy-provisioning UX: when the creator has
no channel yet, show honest setup guidance rather than an error.

## Unit (feature Unit 4)
### New route — `apps/web/src/routes/creators/$creatorId/manage/programming.tsx`
- Loader resolves the creator channel id via `fetchCreatorChannel` (channel-resolve story).
- When `channelId` present: render
  `<EditorialSurface channelId capabilities={{ channelCrud: false, broadcastBanner: false, channelTabs: false }} />`
  wired to the `content` SSE topic (creator-scoped; `playout` topic is admin-only).
- When `channelId` null: render "set up streaming to start programming" guidance, linking to the
  existing Streaming tab where a stream key is created (first key triggers provisioning).

### Nav registration — `manage.tsx`
Add the "Programming" `ContextNavItem` gated on `creatorPermission: "manageStreaming"` (the
manage shell is the `ContextShell` sidebar, not horizontal tabs).

## Acceptance criteria
- [ ] Creator owner sees Programming with their queue/pool/control, scoped to their channel.
- [ ] Viewer-role member does not see the Programming nav item.
- [ ] Pre-provisioning (null channel) shows the setup affordance, not an error.
- [ ] Editorial actions (queue add/remove, pool add/remove) drive the creator's own channel and
      reflect via the `content` spine topic (3s poll fallback as on admin).
- [ ] Fix-verify in the running app (platform convention): user confirms a creator can drive
      their channel's queue live.

## Notes
Terminal story — closing it closes the feature, which closes the `unified-channel-model` epic
(the only feature keeping it at `stage: implementing`). Depends on all three prior stories.

## Implementation discovery (scope bump — surface data layer)
`<EditorialSurface>` hardcoded its API to the **admin** `playout-channels.ts` fetchers
(`/api/playout/*`), and so did its two child pickers — `ContentSearchPicker`
(`searchAvailableContent`) and `AddContentForm` (`assignChannelContent`). A creator mount
rendering it bare would hit admin routes → 403. So mounting required parameterizing the
surface's whole data layer (8 functions, not 7 — the search fetcher rides in via the picker),
plus re-touching `admin/playout.tsx` to inject the admin fetchers explicitly. One surface,
injected data layer, two mounts.

## Implementation notes

### How the data layer was parameterized — `EditorialApiProvider` context
New `components/playout/editorial-api.tsx` defines `EditorialApi` (the 8-function interface),
two module-level bundles satisfying it (`ADMIN_EDITORIAL_API` → `playout-channels.ts`,
`CREATOR_EDITORIAL_API` → the new `creator-playout-channels.ts`), an `EditorialApiProvider`,
and a `useEditorialApi()` hook. The surface and both child pickers now read their fetchers
from the hook instead of importing the admin lib directly. The injected `fetchChannelQueue` is
threaded into `useChannelQueue` too.

Chose a **context provider** over a required `api` prop because the prop drilling would have to
reach the child pickers anyway, and a required prop would have forced an edit to the
zero-edit-regression-gate `editorial-surface.test.tsx` (which renders the surface bare). The
context **defaults to the admin bundle** — but that default is *not* a per-mount fallback: it
exists solely because the isolated component tests mock the admin module at module scope and
render bare, so the default resolves to exactly the mocked functions. **Both production mounts
wrap the provider explicitly** (admin → `ADMIN_EDITORIAL_API`, creator → `CREATOR_EDITORIAL_API`),
so no production mount relies on the default — no silent admin-endpoint footgun in the creator
path.

### Creator fetchers — `lib/creator-playout-channels.ts`
Eight fetchers, identical signatures to `playout-channels.ts`, base path swapped to
`/api/creator/playout/channels/*`. Channel CRUD (`createChannel`/`deleteChannel`) intentionally
omitted — that's admin-only.

### Route — `routes/creators/$creatorId/manage/programming.tsx`
Loader resolves the channel id server-side via `fetchApiServer` against
`/api/creators/:id/channel` (SSR-safe; the client `fetchCreatorChannel` lib hits the same
endpoint from the browser). When `channelId` present: renders `<EditorialSurface>` inside
`<SpineProvider topics={["content"]}>` + `<EditorialApiProvider api={CREATOR_EDITORIAL_API}>`,
`spineTopic="content"`, capabilities all false. When `channelId` null: renders the setup card
(not an error) linking to the Streaming tab.

### Nav — `manage.tsx`
Added `{ to: "/programming", label: "Programming", creatorPermission: "manageStreaming" }` to
`MANAGE_ITEMS`. `manageStreaming` is owner-only in `CREATOR_ROLE_PERMISSIONS`, so the existing
`itemFilter` (matrix gate) hides it for editor/viewer automatically — no special-case needed.

### Null-state UX
`programming-manage.module.css` setup card: heading "Set up streaming to start programming",
honest guidance copy, and a `<Link>` to `/creators/$creatorId/manage/streaming`. No `role="alert"`.

### Admin behavior unchanged
`admin/playout.tsx` only gained the `<EditorialApiProvider api={ADMIN_EDITORIAL_API}>` wrapper
around its existing `<EditorialSurface>`; its CRUD/poll still use the direct admin imports. The
admin playout route tests and the isolated `<EditorialSurface>` tests pass with **zero edits**.

### Tests added
- `lib/creator-playout-channels.test.ts` — all 8 fetchers hit `/api/creator/playout/*`.
- `routes/creators/manage/programming.test.tsx` — surface renders on `content` topic when
  channel present; setup affordance (no error) + Streaming link when null.
- `routes/creators/manage/manage.test.tsx` — Programming nav visible for owner/admin, hidden
  for editor/viewer.

Full web suite: 167 files / 1791 tests green. `tsc --noEmit` clean.
