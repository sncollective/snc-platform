---
tags: [content, community]
release_binding: null
created: 2026-04-20
updated: 2026-04-21
---

# Comments on Content

Threaded comments on content items: REST API with async delivery, `parent_id` for reply threading. Shares a moderation layer with live chat — moderation tooling needs to handle both surfaces. Scope includes the data model, API endpoints, and the comment UI on content detail pages.

## Pattern references

See [live-streaming-ux-patterns.md](../research/live-streaming-ux-patterns.md):

- **§2.3 Replies & threading** — inline-grouped (Twitch) vs split-panel (Discord) vs flat (YouTube Live). For async content comments, inline-grouped is the most discoverable pattern — keeps conversation in one column rather than hiding sub-threads in side panels. Discord's split-panel model is overkill for comment volume typical of content items.
- **§2.1 Message rendering** — badges, timestamps, mentions, emotes, system messages. Same rendering vocabulary should apply to comments as to chat; reusing the component surface keeps both consistent.
- **§3 Moderation & viewer safety** (all subsections) — research's moderation patterns apply to comments as strongly as to chat. Content comments need channel modes (slow / verified / muted), AutoMod-equivalent, mod tools (timeout, delete, ban-from-commenting), viewer-side safety (block, report, mute-words), audit/transparency, and the governance-aligned patterns from §3.10.

## Scoping notes

- Overlaps with [streaming-vod-threaded-comments](streaming-vod-threaded-comments.md) — VOD is a content type; these likely share infrastructure. Resolve duplication at scope time.
- Moderation re-use: `feature-chat-moderation` (shipped 0.3.0) handles live chat; extending it to comments means the same authorization layer (`canModerateRoom` → `canModerateContent`), the same `chat_moderation_actions` table (generalize to `moderation_actions`), the same UI (`ChatUserCard` → shared `UserCard`). Large design decision — one moderation substrate for both surfaces, or parallel implementations. Research §3.10's "one moderation substrate across surfaces" is implicitly the co-op-aligned choice.
- Reactions: if reactions extend to comments, `feature-message-reactions` schema generalizes from `(messageId, userId, emoji)` to `(targetType, targetId, userId, emoji)`. Not blocking this item but worth deciding before both surfaces ship reactions separately.
