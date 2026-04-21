---
tags: [streaming]
release_binding: null
created: 2026-04-20
---

# S/NC TV Fallback Dynamic Channel

2026-04-06: Decouple S/NC TV fallback from the hardcoded `classics` channel. Currently `playout.liq` references the `classics` Liquidsoap source directly as the S/NC TV fallback. The fallback should instead reference the broadcast channel's `defaultPlayoutChannelId` from the database, resolved at config generation time. This is part of the broader S/NC TV broadcast source selector work where an admin chooses what's on air (live creator, playout channel, scheduled event) with intelligent fallback based on priority — the fallback channel must be database-driven rather than baked into the Liquidsoap script.
