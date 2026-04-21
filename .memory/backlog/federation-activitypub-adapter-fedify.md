---
tags: [federation]
release_binding: null
created: 2026-04-20
---

# ActivityPub Adapter via Fedify

Integrate ActivityPub support using the `@fedify/hono` middleware for route handling and `@fedify/postgres` for the KvStore and MessageQueue backends. This adapter is the primary federation protocol implementation, given ActivityPub's position at the top of the protocol priority order.
