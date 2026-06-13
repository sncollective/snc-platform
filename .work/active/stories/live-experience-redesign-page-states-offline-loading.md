---
id: live-experience-redesign-page-states-offline-loading
kind: story
stage: implementing
tags: [streaming]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: live-experience-redesign-page-states
---

# Channel-zone loading skeleton + honest offline state

Implements **Unit 2** of the parent feature's design (read `## Implementation Units`
→ Unit 2 in the parent body for exact signatures, CSS, and notes).

## Scope

`apps/web/src/routes/live.tsx` + `apps/web/src/routes/live.module.css` only. Adds
`ChannelZoneSkeleton` (pulsing selector-footprint placeholder rendered while
`isLoading`) and replaces `ComingSoonPlaceholder` with `OfflinePlaceholder` ("Nothing
live right now" + honest copy + `<Link to="/calendar">` per the epic's offline-state
decision; `/calendar` is the stable alias, 301-handled by the router). CSS: rename
`.comingSoon*` → `.offline*`, add skeleton classes reusing the `pulse` keyframes,
delete the orphaned `.playerSkeleton` class (its replacement lives in
global-player.module.css via the sibling `player-skeleton` story), add the
`prefers-reduced-motion` guard.

Keep `OfflinePlaceholder` a simple named component — the sibling `notify-me` feature
adds its capture affordance to this surface later.

## Acceptance

- [ ] With no SSR data, the channel-selector zone shows a pulsing placeholder until the
      first client fetch resolves (no blank main area)
- [ ] With zero active channels, the page shows "Nothing live right now" with honest
      copy and a working link to `/calendar`
- [ ] "Coming Soon" copy no longer exists anywhere on the live page
- [ ] Orphaned `.playerSkeleton` gone from live.module.css; `pulse` keyframes remain
- [ ] `tests/unit/routes/live.test.tsx` extended per parent `## Testing`
