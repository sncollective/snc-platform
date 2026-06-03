---
tags: [streaming]
release_binding: null
created: 2026-04-20
---

# ensurePlayout() Channel Name Not Updated on Existing Channels

`ensurePlayout()` does not update the channel name when the channel already exists. The seed script logs success but the old name persists in the DB. Relevant to prod cutover — if a channel was seeded before a name change, the stale name will remain. The Phase 5 post-review fix updated `ensurePlayout()` to always set `name + isActive` on upsert; verify whether that fix covered this path or whether there is a separate code branch where the name update is skipped.
