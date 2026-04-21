---
tags: [streaming, admin-console]
release_binding: null
created: 2026-04-21
---

# S/NC TV Broadcast Source Selector

Admin UI for choosing what's on air for S/NC TV: live creator, playout channel, or scheduled event. Intelligent priority-based fallback when nobody is actively managing (e.g., scheduled event > live creator > default playout channel). The `defaultPlayoutChannelId` on the channels table already supports this at the data layer. Enabled by the playout channel architecture rethink — playout channels become selectable sources in the broadcast source list.
