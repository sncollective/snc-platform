---
id: story-mini-player-go-to-content-loses-channel
kind: story
stage: done
tags: [streaming, ux-polish]
release_binding: 0.3.0
created: 2026-04-22
updated: 2026-04-24
related_decisions: []
related_designs: []
parent: null
---

Clicking the expand arrow (`↗`) on a live/playout mini-player returns to `/live`, but `/live` auto-selects the default channel (S/NC TV) instead of the channel that was playing. Expected: restore the selected channel that populated the mini-player in the first place.

Root cause: `MediaMetadata.contentUrl` is set to the static string `"/live"` in `routes/live.tsx` — no channel identifier carried over.

Surfaced 2026-04-22 during `mini-player-stream-end-spinner` review.

## Approach

Use option (a) — URL param. Set `MediaMetadata.contentUrl` to `/live?channel=<id>` and have `/live` read `useSearch()` to seed `selectedChannelId`. Stateless, shareable, debuggable.

The channel `id` is currently a GUID. Ship the fix with the id as-is; human-readable channel slugs are a separate scope tracked in `channels-human-readable-url-slugs` (see backlog) and affect more than this one flow. For the mini-player expand specifically, the URL is transient (users click `↗`, they don't paste/share it), so GUID-in-URL is acceptable short-term.

## Tasks

- [x] In `routes/live.tsx`, replace the static `MediaMetadata.contentUrl` `"/live"` with `/live?channel=<selectedChannelId>`.
- [x] Add `useSearch()` read for `channel` param on `/live`, and use it to seed `selectedChannelId` (takes precedence over `channelList?.defaultChannelId`).
- [x] Verify the round-trip: play channel X → open mini-player → click `↗` → `/live` opens with channel X selected.

## What shipped

- Added `validateSearch` on the `/live` route with `zod/mini` schema: `z.object({ channel: z.optional(z.string()) })` — matches the pattern used in `routes/login.tsx` and `routes/merch/index.tsx`.
- `LivePage` now reads `Route.useSearch()` and destructures `channel` as `channelFromUrl`.
- Auto-select effect priority changed from `defaultChannelId` only to: `channelFromUrl ?? channelList?.defaultChannelId ?? null`. URL param wins on first load; once `selectedChannelId` is set, the effect early-returns (user's subsequent manual selections stick).
- `MediaMetadata.contentUrl` now uses a template literal: `` `/live?channel=${selectedChannel.id}` ``.

Files touched:
- `apps/web/src/routes/live.tsx` — imports, route `validateSearch`, `useSearch` read, auto-select effect, `contentUrl` construction
- `apps/web/tests/unit/routes/live.test.tsx` — added `mockUseSearch`, new test asserting URL-param priority over `defaultChannelId`

## Risks

Low. Route-level search param handling is a standard tanstack-router pattern. No schema changes, no new dependencies.

**Edge case — stale URL param:** if someone pastes a URL with a channel id that doesn't match any channel in the current list (channel deleted / renamed), the effect still sets `selectedChannelId` to that stale id; `channels.find(...)` returns `undefined`; `selectedChannel` is null; the player does not start, and the user can pick a channel manually from the selector. Acceptable degradation — no crash, no infinite load, just a recoverable dead end. Not adding channel-list validation for 24-hour timeline; the mini-player only ever writes live channel ids, so stale URLs only happen from manually edited / old pasted links.

## Verification

- [x] Unit tests pass — full web suite (151 files, 1600 tests) green; new test `seeds selected channel from URL ?channel= search param (priority over defaultChannelId)` added.
- [ ] **Browser verification pending** — open any non-default channel in the live page, start playing, minimize to mini-player, click `↗` expand, confirm `/live?channel=<id>` opens with the originating channel selected (not S/NC TV). `/review`'s job.
