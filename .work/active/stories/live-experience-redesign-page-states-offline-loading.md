---
id: live-experience-redesign-page-states-offline-loading
kind: story
stage: review
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

- [x] With no SSR data, the channel-selector zone shows a pulsing placeholder until the first client fetch resolves (no blank main area)
- [x] With zero active channels, the page shows "Nothing live right now" with honest copy and a working link to `/calendar`
- [x] "Coming Soon" copy no longer exists anywhere on the live page
- [x] Orphaned `.playerSkeleton` gone from live.module.css; `pulse` keyframes remain
- [x] `tests/unit/routes/live.test.tsx` extended per parent `## Testing`

## Implementation notes

**What was done:**

- `apps/web/src/routes/live.tsx`: Extended the `@tanstack/react-router` import with `Link`. Replaced `ComingSoonPlaceholder` (deleted entirely) with two new components: `ChannelZoneSkeleton` (pulsing flex row with `role="status"` + `aria-label="Loading channels"`) and `OfflinePlaceholder` ("Nothing live right now" heading + honest copy + `<Link to="/calendar">`). Updated `LivePage` render wiring to show skeleton while `isLoading` and offline placeholder when `!hasChannels && !isLoading`.

- `apps/web/src/routes/live.module.css`: Deleted orphaned `.playerSkeleton`. Renamed `.comingSoon` → `.offline`, `.comingSoonHeading` → `.offlineHeading`, `.comingSoonText` → `.offlineText` (added `margin-bottom` to offlineText for spacing before the link). Added `.offlineCalendarLink` (accent color, underline on hover). Added `.channelZoneSkeleton` (flex row, gap-md), `.skeletonSelect` (240×36px), `.skeletonLine` (80×16px) — both using `@keyframes pulse`. Added `@media (prefers-reduced-motion: reduce)` guard. Kept `@keyframes pulse` and `@keyframes livePulse`.

- `apps/web/tests/unit/routes/live.test.tsx`: Hoisted `mockApiGet` into the `vi.hoisted()` block and wired it into the `fetch-utils.js` mock. Updated the stale "renders Coming Soon" test → "renders offline placeholder". Replaced the stale "does not render Coming Soon" loading test with: (a) "renders channel zone skeleton while loading" (keeps fetch pending via never-resolving promise, asserts `role="status"` skeleton), (b) "renders calendar link in offline placeholder" (asserts `href="/calendar"`), (c) "does not render offline placeholder while loading" (updated copy).

**Test counts:** 15 tests pass in `live.test.tsx` (was 13; +4 new, removed 2 stale). Full web unit suite: 1630 passing, 2 failures pre-existing in sibling `chat-panel.test.tsx` (owned by a concurrent sibling agent — not caused by this story).

## Review (2026-06-13)

**Verdict**: Approve — held at review on fix-verify loopback (user confirms in the
running app). Feature-level deep review verified design conformance, acceptance
criteria, and a11y of the new states; full web suite green.
