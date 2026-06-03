---
tags: [streaming, community]
release_binding: null
created: 2026-04-20
---

# Duplicate chat rooms per live channel

`chat_rooms` contains two rows with the same `channel_id` for Maya Chen's live channel:

```
id                                   | type    | name               | channel_id
f6fb1386-24a6-4d3e-8822-5f87f45a3c3d | channel | Maya Chen's Stream | 2b72f4eb-...
3d198ad7-ba30-444e-95f9-44c58d6415da | channel | Maya Chen's Stream | 2b72f4eb-...
```

Surfaced 2026-04-20 during `chat-moderation` review while auditing chat rooms for S/NC Music's missing room.

Likely cause: `ensureLiveChannelWithChat` (called from SRS `on_publish` callback when a creator starts a stream) isn't idempotent on the chat-room side. Each stream restart creates a new chat room instead of reusing the existing one for that channel.

Consequences:
- Chat history is split across rooms; viewers who joined in different stream sessions see different history.
- Moderation actions bound to one room don't apply to the other.
- DB row growth scales with stream restarts, not creators.

## Scope

- Make `ensureLiveChannelWithChat` idempotent: if a chat room already exists for the channel, reuse it; do not create a second.
- Decide whether to reconcile existing duplicates (merge messages into the most recent/oldest room, drop the other) or leave as historical noise.
- Add a unique constraint `(channel_id)` where `type = 'channel'` to prevent regressions, OR document the case for multi-room-per-channel if there's a legitimate reason.

## Verification when picked up

- [ ] Restart Maya's stream twice — no new chat room created each time
- [ ] Existing duplicates reconciled or documented
- [ ] DB-level constraint prevents future duplicates
