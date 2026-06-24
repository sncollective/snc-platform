---
title: "Clipping Comparators — Incumbent Clip Implementation Survey"
campaign: stream-clipping-twitch-parity
facet: clipping-comparators
provenance: agent-synthesis
updated: 2026-06-24
attestation_handles:
  - twitch-clips-api-docs
  - youtube-clips-help
---

# Clipping Comparators: Incumbent Clip Implementation Survey

This brief documents how Twitch and YouTube implement their clipping features, sourced from each platform's own primary documentation fetched during this engagement. Kick documentation was completely inaccessible during this engagement (all kick.com requests returned HTTP 403; help.kick.com articles returned 403; docs.kick.com has no clips section). Kick is treated as a gap throughout; the gap is flagged as a blocking acquisition candidate.

---

## Twitch Clips

Source: Twitch Developer Documentation, "Clips" [twitch-clips-api-docs]{1}

### Who can create a clip

The Create Clip API requires an OAuth user access token with the `clips:edit` scope [twitch-clips-api-docs]{2}. A logged-in user must make the request — anonymous clipping is not supported. Three conditions must all be true [twitch-clips-api-docs]{3}:

1. The broadcaster is actively streaming (live-only; see §Live vs. VOD below).
2. The broadcaster has enabled clips in their Creator Dashboard settings.
3. The requesting user meets any follower/subscriber restriction the broadcaster has configured — or no such restriction exists.

The documentation names **follower-only** and **subscriber-only** as configurable modes, meaning a channel owner can gate clip creation to followers or paying subscribers [twitch-clips-api-docs]{4}. The documentation does not specify whether "any logged-in viewer" is the default unrestricted state, but the three-condition structure implies that without follower/subscriber restrictions set, any authenticated user can clip.

### Clip length limits

- **Capture window:** Up to 90 seconds total — approximately 85 seconds before the API call and 5 seconds after [twitch-clips-api-docs]{5}.
- **Default published length:** The last 30 seconds of the 90-second window, with an auto-generated title [twitch-clips-api-docs]{6}.
- **Editor range:** 5 seconds (minimum) to 60 seconds (maximum) [twitch-clips-api-docs]{7}.

The creator of a clip can use the `edit_url` (valid for up to 24 hours or until the clip is published) to choose any 5–60 second segment from within the 90-second capture window and set a custom title [twitch-clips-api-docs]{8}.

### How clips are created — rolling buffer + editor

Clip creation is asynchronous via the API (`POST /helix/clips`). The rolling buffer captures the preceding ~85 seconds on demand [twitch-clips-api-docs]{9}. On Twitch's user-facing product, the clip button in the video player triggers this same API call. The `has_delay` parameter (boolean, default `false`) shifts the capture window slightly to the right when the broadcaster has stream delay enabled — relevant so the clip content matches what the viewer experienced rather than what was in the buffer at API call time [twitch-clips-api-docs]{10}.

### Attribution

The Get Clips API response includes both `creator_id`/`creator_name` (the user who made the clip) and `broadcaster_id`/`broadcaster_name` (the channel being clipped) [twitch-clips-api-docs]{11}. Both parties are attributed in the clip data object. The API also returns `video_id` and `vod_offset` (seconds from VOD start), enabling the clip to be linked back to the source VOD timestamp [twitch-clips-api-docs]{12}.

### Clip page and discovery

The documentation describes clips as designed to enable "social sharing" and "grow channels" [twitch-clips-api-docs]{13}. The API returns a `url` field (the clip's public URL) and a `thumbnail_url`. Clips from a broadcaster can be retrieved via `broadcaster_id` and are returned in descending view count order [twitch-clips-api-docs]{14}. The documentation does not describe a Clips tab UI explicitly — it is the developer API documentation, not a help center UI walkthrough. The help center UI (which would document the Clips tab on channel pages) was inaccessible during this engagement (Twitch's help portal returned JavaScript rendering errors on all `help.twitch.tv` requests).

Discovery endpoints: clips can be queried by broadcaster, by game, or by specific clip IDs. Game-level queries return clips from any broadcaster playing that game, sorted by view count [twitch-clips-api-docs]{15}.

### Live vs. VOD clipping

The Create Clip API explicitly requires the broadcaster to be "actively streaming" — the documentation states clip creation is only possible during a live broadcast [twitch-clips-api-docs]{16}. VOD clips (clipping from a recorded video when not live) are not described in the API documentation as a distinct creation path. However, the `vod_offset` field in Get Clips responses shows that clips are associated with the corresponding VOD once it is available [twitch-clips-api-docs]{17}, indicating clips created during a live broadcast gain a VOD link after the stream ends.

### Clip moderation and management

The API documentation covers creation and retrieval only. No Delete Clips endpoint or creator moderation controls are documented on the fetched page [twitch-clips-api-docs]{18}. The Creator Dashboard settings referenced in the eligibility requirements (enabling/disabling clip creation channel-wide, setting follower/subscriber restrictions) are stated as existing but the help center article describing those settings was inaccessible.

**Gap:** Whether the broadcaster (channel owner) can delete individual clips made by viewers, and the UI-level clip moderation flow (reporting, deleting), is unconfirmed from a fetched primary source. The API documentation does not document a delete endpoint for clips.

### Disable clips

A channel-level toggle exists in the Creator Dashboard settings — the documentation states clips can only be created when "the broadcaster has enabled clips in Creator Dashboard settings" [twitch-clips-api-docs]{19}, implying a disable option. The exact UI path for disabling is unconfirmed from a fetched source (help center inaccessible).

---

## YouTube Clips

Source: YouTube Help, "Manage Clips" [youtube-clips-help]{1}

### Who can create a clip

"Clipping videos is turned on by default" [youtube-clips-help]{2} — any viewer can clip eligible videos. The page states no subscriber count minimum, no account tier requirement, and no account type restriction. The page does not address Made For Kids content restrictions — that gap is noted.

### Clip length limits

- **Minimum:** 5 seconds [youtube-clips-help]{3}
- **Maximum:** 60 seconds [youtube-clips-help]{4}

The selection is made via a draggable slider during clip creation [youtube-clips-help]{5}.

### How clips are created

Viewers select a 5–60 second segment from the current video using a slider. The page focuses on the YouTube app flow. No rolling buffer description equivalent to Twitch's is given — YouTube Clips operate as segment-selectors from an already-available video (live or uploaded), not a rolling capture [youtube-clips-help]{6}.

### Attribution

The page states creators can see "who made it" (clipper identity) in YouTube Studio clip analytics [youtube-clips-help]{7}. The page does not describe the public-facing clip page attribution — whether a clip page displays the clipper's username or the original creator's name to general viewers is not stated in the fetched documentation.

### Clip page and discovery

Clips appear on:
- The Clips library in the YouTube app ("You" tab → "Your Clips") [youtube-clips-help]{8}
- "Search, discovery, and analytics surfaces" [youtube-clips-help]{9}
- An optional "Top community clips" shelf on the channel homepage, enabled via YouTube Studio → Customization → Add section → "Top community clips" [youtube-clips-help]{10}. This shelf organizes clips "by popularity and how recently they were created" and is publicly visible [youtube-clips-help]{11}.

### Live vs. VOD clipping

"You can't create Clips from live streams without DVR or live streams longer than the DVR timeframe." [youtube-clips-help]{12} Live stream clips "appear only after streaming concludes and uploads as video" — meaning they are not immediately available during the live broadcast, only after the stream ends and the VOD is processed [youtube-clips-help]{13}. Regular uploaded video clips have no such constraint.

### Clip moderation and management

Creators can manage clips in YouTube Studio. Actions available on viewer-made clips: share, play, "hide user from channel," or "report clip" [youtube-clips-help]{14}. The page does not state that creators can directly delete clips made by viewers — deletion is only described for clips the creator themselves made [youtube-clips-help]{15}.

Reporting mechanism: "Report clip" is listed as an available action for creators [youtube-clips-help]{16}.

### Disable clips — exact path

From the fetched documentation, the exact steps to disable clipping on a YouTube channel [youtube-clips-help]{17}:
1. Sign in to YouTube Studio
2. From the left Menu, click Settings
3. Select Channel → Advanced Settings
4. Under Clips, uncheck "Allow viewers to clip my content"
5. Click Save

Additional per-user controls: a "Hidden users" list prevents specific users from clipping [youtube-clips-help]{18}. Blocked words prevent certain terms in clip titles [youtube-clips-help]{19}.

### Clip availability conditions

Clips become unavailable if the source video is deleted, set to private, or violates Community Guidelines [youtube-clips-help]{20}. Clips from unlisted videos remain available [youtube-clips-help]{21}.

### Shorts integration

"Creators can remix clips into Shorts if the source video is eligible for remix. Clip creators can convert an entire clip into a Short." [youtube-clips-help]{22}

---

## Kick Clips

**All primary documentation inaccessible.** Every attempted fetch of kick.com, help.kick.com, and kick.com/help returned HTTP 403 Forbidden during this engagement. The Kick Developer API documentation at docs.kick.com has no clips or VOD section in its sitemap [confirmed by fetching docs.kick.com/sitemap.md and docs.kick.com/llms.txt — no clips endpoint documented as of 2026-06-24]. Kick's changelog at docs.kick.com also contains no mention of clips or VOD features.

All claims about Kick clips from training recall are FORBIDDEN per discipline. Kick entries in the parity table below are left blank with gap markers.

---

## Disconfirming Analysis

**Against "clipping is universally open to any viewer":** Twitch's API documentation explicitly names follower-only and subscriber-only restriction modes as configurable on a per-channel basis [twitch-clips-api-docs]{4}. This is a direct disconfirmation of a "open to all viewers" universal claim about Twitch. YouTube's page states "turned on by default" with no mention of a similar gating mechanism per viewer type, which is a difference in design philosophy between the two platforms.

**Against "creators can delete any clip on their channel":** YouTube's help page specifically does not list deletion as an action available to creators for viewer-made clips — only share, play, hide user, and report [youtube-clips-help]{14}. This disconfirms a common assumption that platform creators have full deletion control over all clips on their channel (at least for YouTube). Twitch's position is unconfirmed from fetched sources.

**Against "live clipping is the primary use case":** YouTube's model requires DVR functionality for live clips and the clips only appear after the stream ends [youtube-clips-help]{12,13}. Twitch's API only documents live-stream clip creation (requires "actively streaming"), though clips gain VOD associations [twitch-clips-api-docs]{16,17}. Both platforms tie live clipping to availability constraints.

---

## Contradictions

No direct contradiction between Twitch and YouTube primary documentation was found on overlapping features. The platforms document different mechanisms with some structural similarities:

- Both have a 5-second minimum clip length (confirmed for both from their respective docs).
- Both have a 60-second maximum published clip length (Twitch: 5–60 second editor range; YouTube: 5–60 second selection). These numbers align.
- Both require the creator to have clips enabled (Twitch: Creator Dashboard toggle; YouTube: Advanced Settings toggle).
- Both support attribution of the clipper (Twitch: `creator_name` API field; YouTube: Studio analytics show "who made it").

One structural difference that is not a contradiction but a design divergence: Twitch uses a rolling buffer (90 seconds captured at the API call moment), while YouTube uses segment selection from an already-available video. These are distinct architectural approaches, not contradictory claims about the same mechanism.

---

## Parity Table

| Feature | Twitch | YouTube | Kick |
|---|---|---|---|
| **Who can clip** | Any authenticated user by default; channel can restrict to followers-only or subscribers-only [twitch-clips-api-docs]{3,4} | Any viewer by default; creator can disable per-channel or per-user [youtube-clips-help]{2} | **UNCONFIRMED** — source inaccessible |
| **Clip length min** | 5 seconds [twitch-clips-api-docs]{7} | 5 seconds [youtube-clips-help]{3} | **UNCONFIRMED** |
| **Clip length max** | 60 seconds (editor range; default publish = 30 sec) [twitch-clips-api-docs]{7,6} | 60 seconds [youtube-clips-help]{4} | **UNCONFIRMED** |
| **Rolling buffer** | Yes — 90-second buffer (~85s before + ~5s after API call) [twitch-clips-api-docs]{5} | No — segment selection from available video [youtube-clips-help]{6} | **UNCONFIRMED** |
| **Live clipping** | Yes — requires active broadcast [twitch-clips-api-docs]{16} | Yes, with DVR required; clips only available after stream ends [youtube-clips-help]{12,13} | **UNCONFIRMED** |
| **VOD clipping** | Not documented as a distinct creation path; clips gain VOD association post-broadcast [twitch-clips-api-docs]{17} | Yes — clips from uploaded videos have no live constraint [youtube-clips-help]{6} | **UNCONFIRMED** |
| **Attribution — clipper** | `creator_name` in API response; public display unconfirmed (help center inaccessible) [twitch-clips-api-docs]{11} | Visible to creator in Studio analytics; public display on clip page unconfirmed [youtube-clips-help]{7} | **UNCONFIRMED** |
| **Attribution — streamer/creator** | `broadcaster_name` in API response [twitch-clips-api-docs]{11} | Source channel; public display on clip page unconfirmed [youtube-clips-help]{7} | **UNCONFIRMED** |
| **VOD timestamp link** | Yes — `vod_offset` field links clip to position in VOD [twitch-clips-api-docs]{12} | Not documented in fetched source | **UNCONFIRMED** |
| **Discovery** | Broadcaster clips retrievable by view count; game-level clip queries [twitch-clips-api-docs]{14,15}. UI Clips tab: not confirmed from fetched source | "Top community clips" shelf (opt-in); Clips library; search/discovery surfaces [youtube-clips-help]{8,9,10} | **UNCONFIRMED** |
| **Creator can disable** | Yes — Creator Dashboard toggle [twitch-clips-api-docs]{19}; UI path unconfirmed | Yes — YouTube Studio → Settings → Channel → Advanced Settings → uncheck "Allow viewers to clip" [youtube-clips-help]{17} | **UNCONFIRMED** |
| **Follower/subscriber gate** | Yes — configurable per channel [twitch-clips-api-docs]{4} | Not documented (per-user hide list available) [youtube-clips-help]{18} | **UNCONFIRMED** |
| **Creator deletes viewer clips** | Not documented in fetched API docs | Not available per help page (creator can report/hide user, not delete) [youtube-clips-help]{14,15} | **UNCONFIRMED** |
| **Reporting** | Not documented in fetched API docs | "Report clip" action available to channel owner [youtube-clips-help]{16} | **UNCONFIRMED** |
| **Clip-to-short** | Not documented in fetched sources | Yes — eligible clips can be remixed into Shorts [youtube-clips-help]{22} | **UNCONFIRMED** |
| **Per-user block** | Not documented in fetched sources | Yes — "Hidden users" list [youtube-clips-help]{18} | **UNCONFIRMED** |

---

## Gaps and Unconfirmed Items

**Twitch UI-level gaps** (help.twitch.tv was inaccessible — JavaScript-rendered, returned CSS errors on every request):
- Exact UI path for disabling clips in Creator Dashboard
- Whether the Clips tab appears on all channel pages or only certain tiers
- Whether the broadcaster (channel owner) can delete individual viewer-made clips
- Whether clip creation is available to non-follower, non-subscriber logged-in users by default (implied yes from API docs but not stated explicitly as "any logged-in viewer")
- Clip reporting UI for viewers (vs. channel owners)
- Whether clips can be created from VODs directly (not live streams)
- Creator Camp / help center documentation on clip discovery surfaces (Trending, featured clips)

**YouTube gaps** (page did not address):
- Eligibility restrictions for Made For Kids / COPPA-flagged channels
- Whether clips are available on all channel types (e.g., music channels, verified artist channels)
- Public-facing attribution display on the clip page (what viewers see)
- Whether there is a subscriber count minimum for the "Top community clips" shelf feature

**Kick — complete gap** (source inaccessible):
- All Kick clip features are unconfirmed from fetched sources

---

## Revisit If

- Twitch's help.twitch.tv portal becomes accessible to non-browser fetching tools (currently JavaScript-rendered, breaks WebFetch) — re-fetch `help.twitch.tv/s/article/how-to-use-clips` for UI-level clip behavior documentation.
- Kick adds clips to docs.kick.com, or help.kick.com articles become accessible to WebFetch.
- YouTube updates its Clips help page to describe public-facing attribution on clip pages.
- A sibling specialist facet (`viewer-ugc-product`) requires the parity table to be extended with S/NC's intended model — at that point the `UNCONFIRMED` rows for Kick become more pressing.
- Platform-level eligibility constraints for YouTube Clips (e.g., Made For Kids, age-gated content) are needed — requires fetching a separate YouTube help article addressing those restrictions specifically.
