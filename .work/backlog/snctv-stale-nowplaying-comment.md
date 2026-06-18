---
id: snctv-stale-nowplaying-comment
tags: [documentation, streaming]
release_binding: null
created: 2026-06-18
---

# [docs] playout.ts comment still references the deleted legacy /now-playing endpoint

`apps/api/src/services/playout.ts` (the `getPlayoutNowPlaying` JSDoc, ~line 167) still says:
"Used for the broadcast channel (S/NC TV) which still uses the legacy /now-playing endpoint."

The `snctv-composition` feature **deleted** the legacy `/now-playing` harbor endpoint and repointed
`getNowPlaying` (which `getPlayoutNowPlaying` calls) at the broadcast channel's per-channel path. The
comment is now false — rolling-foundation drift surfaced by the feature deep review.

Fix: update the comment to reflect that S/NC TV now reads its per-channel
`/channels/<broadcastId>/now-playing` (resolved by `ownership=platform, role=broadcast`). One-line
doc correction.

Origin: `snctv-composition` feature deep review (2026-06-18), IMPORTANT finding.
