---
id: unified-channel-model-creator-enablement-mount
kind: story
stage: implementing
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

## Review findings — BOUNCED (cross-model review, Codex high)
The mount implemented the surface parameterization cleanly (creator fetchers hit
`/api/creator/playout/*`, admin mount unchanged, null-state UX correct, search picker + surface
use injected context). But cross-model review caught two functional Blockers the green tests missed
(tests used id-shaped fixtures, hiding the handle bug). Verdict: **Bounce**.

### BLOCKER 1 — handle-vs-id mismatch makes Programming show "unprovisioned" for real channels
The manage nav builds URLs with `creator.handle ?? creator.id` (`manage.tsx:96`), so the route
param `creatorId` is usually a **handle**. The Programming loader (`programming.tsx:35`) passes that
param straight to `/api/creators/${params.creatorId}/channel`. But that endpoint
(`creator.routes.ts:275`, the channel-resolve story) looks up by literal id —
`requireCreatorPermission(user.id, creatorId, …)` and `findCreatorChannelId(creatorId)` both match
`eq(channels.creatorId, creatorId)` / the membership row by id, NOT handle. (Contrast the public
`GET /:creatorId` at `:164`, which uses the dual-mode `findCreatorProfile` handle-or-id resolver.)
So for any creator with a handle, the channel lookup fails → `programming.tsx:38`'s blanket
`.catch(() => ({channelId: null}))` swallows it → the page shows "set up streaming" **even when the
creator has a fully provisioned channel.** Broken for the common case, masked by the catch-all.

**Fix (spans two stories):**
- **channel-resolve endpoint** (`creator.routes.ts` GET `/:creatorId/channel`): resolve the param
  handle→canonical-id before the permission check + channel lookup, mirroring `findCreatorProfile`'s
  dual-mode resolver. This is the real home of the bug — the endpoint's AC didn't account for handle
  params. (channel-resolve reopened — see its file.)
- **mount loader** (`programming.tsx:35-39`): do NOT blanket-catch all errors as "no channel." A 403
  (auth) or 5xx is not "unprovisioned" — only a successful `{channelId: null}` is. Distinguish them
  so a real failure surfaces instead of silently showing the setup card.

### BLOCKER 2 — creator "Create New" uses admin-only playout-item creation
`AddContentForm`'s "Create New" path (`add-content-form.tsx:5,46`) calls `createPlayoutItem` →
`POST /api/playout/items` (admin-only), then assigns the returned **playout item id**
(`:51`). But the hardened creator content path REJECTS playout-item assignment for creator scope
(the api-gate round-2 fix — creators can't assign platform playout items; pool is content-only). So
on the creator mount, "Create New" 403s at creation (admin route) and/or is rejected at assignment.
The capability flags (`channelCrud`/`broadcastBanner`/`channelTabs`) don't cover this create path.

**Fix:** for the creator mount, either (a) hide "Create New" (creators add to the pool via search
over their OWN existing content — `assignContent` with `contentIds`, which IS allowed), or (b) wire
a creator-owned content-creation/upload path that assigns via `contentIds` not `playoutItemIds`.
Option (a) is the smaller correct fix and matches the content-only pool model; (b) is a larger
feature. Add a capability flag (e.g. `canCreateContent`) or thread the create affordance through the
injected API so the creator mount omits it.

### IMPORTANT 1 — Programming is nav-gated, not route-content gated
The nav item is hidden for editor/viewer (`manage.tsx`, `creatorPermission: manageStreaming`), but
the route component (`programming.tsx:60`) renders without checking `memberRole`/`isAdmin`. A
viewer/editor can navigate directly to `/manage/programming`; the page renders and the backend then
403s every action (data IS protected server-side — the API is the real gate, good defense-in-depth).
But the owner-only UI contract is broken — a non-owner sees controls that don't work.
**Fix:** add a route/component owner guard mirroring the Streaming tab's owner check; test direct
editor/viewer access.

### IMPORTANT 2 — EditorialApiProvider context default is a footgun
`editorial-api.tsx:95` defaults the context to `ADMIN_EDITORIAL_API`. A future mount that forgets the
provider silently hits ADMIN endpoints rather than failing loudly. (Both current mounts wrap
explicitly, so the live feature is correct — this is latent.) Flagged independently by both the
orchestrator and the cross-model reviewer.
**Fix:** `createContext<EditorialApi | undefined>(undefined)` + throw in `useEditorialApi()` when no
provider wraps; wrap the isolated `editorial-surface.test.tsx` (+ child-picker tests) with the
intended provider.

### Good (confirmed by the review)
Creator fetchers correctly target `/api/creator/playout/channels/*`; admin mount wraps
`ADMIN_EDITORIAL_API` with no behavior change beyond the provider; surface + search picker use
injected context (no leftover hardcoded admin import for channel ops); null-channel UX shows setup
guidance, not an error, on a genuine `channelId: null`.
