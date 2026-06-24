---
source_handle: twitch-clips-api-docs
fetched: 2026-06-24
source_url: https://dev.twitch.tv/docs/api/clips
provenance: source-direct
---

# Attestation: Twitch Clips API Documentation

## Summary

The Twitch developer documentation for the Clips API describes how clips are created and retrieved programmatically. The page is titled "Clips" and opens by describing the feature as one that "lets Twitch viewers share interesting moments from broadcasts while letting broadcasters grow their channels through social sharing."

## Key passages and facts

### Eligibility and access controls

The API Create Clip endpoint (`POST https://api.twitch.tv/helix/clips`) requires an OAuth user access token with the **`clips:edit` scope**. Three conditions must be met for clip creation to succeed:

1. The broadcaster must be actively streaming.
2. The broadcaster must have clips enabled in their Creator Dashboard settings.
3. Either clips are unrestricted on the channel, OR the requesting user meets follower/subscriber requirements if those restrictions are enabled.

The documentation notes follower-only or subscriber-only restrictions as a configurable setting on the broadcaster side, meaning a channel owner can limit who is permitted to clip their stream.

### Rolling buffer and capture window

The API captures "up to 90 seconds of the broadcaster's stream," spanning "about 85 seconds of the stream before the call and about 5 seconds after the call." By default, Twitch publishes "up to the last 30 seconds of the 90 seconds window" with an auto-generated title.

### Clip editor and length range

The Create Clip response returns an `edit_url` valid for "up to 24 hours or until the clip is published, whichever comes first." Through this editor, users can specify clip length "from 5 seconds in length to 60 seconds in length" and choose which portion of the 90-second capture window to publish.

### has_delay parameter

An optional `has_delay` boolean parameter defaults to `false`. When set to `true`, "adds a delay before capturing the clip, which basically shifts the capture window to the right slightly." This is relevant when broadcasters have stream delay enabled.

### Asynchronous creation

"Creating a clip is an asynchronous process that can take a short amount of time to complete." Developers should call Get Clips with the returned clip ID within 15 seconds to verify creation. Failure to return within 15 seconds is treated as a failed creation.

### Attribution fields (Get Clips response)

The `GET https://api.twitch.tv/helix/clips` endpoint returns:
- `creator_id` and `creator_name` — the user who created the clip
- `broadcaster_id` and `broadcaster_name` — the broadcaster whose stream was clipped
- `video_id` and `vod_offset` — timestamp within the associated VOD (in seconds from video start)
- `id`, `url`, `thumbnail_url`, `title`, `view_count`, `created_at`, `duration`, `game_id`, `language`, `featured`

The `title` field note: "Note that the `title` field may not contain useful information."

If the VOD is deleted or unavailable, `video_id` becomes empty and `vod_offset` becomes null. During active broadcasts, there may be a delay before `vod_offset` is populated.

### Getting clips (retrieval API)

The Get Clips API supports querying by:
- Up to 100 specific clip IDs (`id` parameter)
- By broadcaster (`broadcaster_id`) — returns clips in descending view count order
- By game (`game_id`) — clips from any broadcaster playing a specific game, sorted by view count
- Date range filtering via `started_at`/`ended_at` (UTC); if `ended_at` omitted, defaults to one week from start

Default returns 20 clips with pagination cursor support.

### VOD clipping

The `vod_offset` field in clip responses indicates that clips can be associated with VODs (not only live streams). A clip created during a live broadcast will have `video_id` and `vod_offset` populated once the VOD is available.

### Clip deletion / moderation

The documentation page does not describe a clip deletion API endpoint or moderation tools. Only creation and retrieval are documented on this page.

## Structural metadata

- Source type: Developer API documentation
- Publisher: Twitch (Amazon subsidiary)
- Page structure: "Clips" overview → "Creating Clips" section → "Getting Clips" section → code examples
- No date stamp visible on the fetched page; changelog entry not referenced
