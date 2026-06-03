---
tags: [streaming, community, admin-console]
release_binding: null
created: 2026-04-20
---

# Playout channel chat room provisioning gap

`S/NC Music` (playout channel) has no row in `chat_rooms`, while `S/NC Classics` (sibling playout channel) and `S/NC TV` (broadcast) both do. Community users on the `/live?channel=snc-music` view would have no chat experience, and admins would have nothing to moderate.

Surfaced 2026-04-20 during `chat-moderation` review. DB check confirmed:

```
channel       | has chat room?
---
S/NC Classics | yes
S/NC TV       | yes
S/NC Music    | NO
Live: Maya Chen | yes (×2 — see separate gap)
```

Likely causes to investigate:
- Playout channel create/seed path didn't call chat-room provisioning for this specific channel (historical, pre-chat-rooms schema).
- Admin creates a new channel via CRUD and chat-room isn't auto-provisioned.

## Scope

- Audit the channels table + chat_rooms table for any other missing pairings.
- Decide provisioning model: at channel create, at first viewer join, or batch backfill.
- Add a migration or admin tool to backfill any channels missing a chat room.
- Ensure any future channel create path provisions a chat room atomically.

## Verification when picked up

- [ ] Every active channel has at least one `chat_rooms` row
- [ ] New admin-created channels auto-provision a chat room at create time
- [ ] `/live?channel=<any-active-channel>` can open the chat panel without 404
