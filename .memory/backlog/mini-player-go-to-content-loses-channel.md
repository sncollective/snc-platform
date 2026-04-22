---
tags: [streaming, ux-polish]
release_binding: null
created: 2026-04-22
---

# Mini-player "Go to content" loses channel context

Clicking the expand arrow (`↗`) on a live/playout mini-player returns to `/live`, but `/live` auto-selects the default channel (S/NC TV) instead of the channel that was playing. Expected: restore the selected channel that populated the mini-player in the first place.

Root cause: `MediaMetadata.contentUrl` is set to the static string `"/live"` in `routes/live.tsx` — no channel identifier carried over.

Surfaced 2026-04-22 during `mini-player-stream-end-spinner` review. Fix options: (a) pass channel id in the URL (`/live?channel=<id>`) and have `/live` read `useSearch()` to seed `selectedChannelId`, or (b) persist last-selected channel in localStorage and prefer it over `defaultChannelId` when present.
