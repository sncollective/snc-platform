---
id: story-mini-player-go-to-content-loses-channel
kind: story
stage: implementing
tags: [streaming, ux-polish]
release_binding: null
created: 2026-04-22
updated: 2026-04-23
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

- [ ] In `routes/live.tsx`, replace the static `MediaMetadata.contentUrl` `"/live"` with `/live?channel=<selectedChannelId>`.
- [ ] Add `useSearch()` read for `channel` param on `/live`, and use it to seed `selectedChannelId` (takes precedence over `channelList?.defaultChannelId`).
- [ ] Verify the round-trip: play channel X → open mini-player → click `↗` → `/live` opens with channel X selected.

## Risks

Low. Route-level search param handling is a standard tanstack-router pattern. No schema changes, no new dependencies.
