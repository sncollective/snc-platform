---
source_handle: vidstack-docs-loading-stream-type
fetched: 2026-06-14
source_url: https://www.vidstack.io/docs/player/core-concepts/loading#stream-type
provenance: source-direct
---

## Paraphrase

The official Vidstack docs page on media loading, specifically the stream-type section. Documents the five available `streamType` values and their behavioral semantics.

## Key passages

**Available `streamType` values (verbatim descriptions):**

1. `on-demand` — "Video on Demand (VOD) content is pre-recorded and can be accessed and played at any time. VOD streams allow viewers to control playback, pause, rewind, and fast forward."

2. `live` — "Live streaming delivers real-time content as it happens. Viewers join the stream and watch the content as it's being broadcast, with limited control over playback."

3. `live:dvr` — "Live DVR (Live Digital Video Recording) combines the features of both live and VOD. Viewers can join a live stream and simultaneously pause, rewind, and fast forward."

4. `ll-live` — "A live streaming mode optimized for reduced latency, providing a near-real-time viewing experience with minimal delay."

5. `ll-live:dvr` — "Similar to low-latency live, this mode enables viewers to experience live content with minimal delay while enjoying DVR features."

**Recommendation:** "if the value is not set, it will be inferred by the player which can be less accurate (e.g., at identifying DVR support)" — recommends specifying explicitly.

**Player uses streamType to:** "determine how to manage state/internals such as duration updates, seeking, and how to appropriately present UI components and layouts."

**No code example** for setting streamType was included in the fetched content. The `streamType` prop is on the `<MediaPlayer>` component (type `MediaStreamType`, default `'unknown'` per the API reference page).

## Structure

Subsection of the loading concepts page. URL includes anchor `#stream-type`.
