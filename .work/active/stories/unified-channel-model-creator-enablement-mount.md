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
updated: 2026-06-21
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
