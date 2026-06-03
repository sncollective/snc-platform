---
tags: [federation]
release_binding: null
created: 2026-04-20
---

# Adapter Architecture

Protocol adapter layer implementing ActivityPub, AT Protocol, Nostr, and Polycentric as pluggable adapters behind a common internal event interface, with a protocol registry for runtime feature-flag control.

**Bullets to split / scope out when this is promoted:**

- ActivityPub adapter via Fedify — `@fedify/hono` middleware, `@fedify/postgres` for KvStore + MessageQueue
- AT Protocol adapter — self-hosted PDS (Docker sidecar, SQLite), `@atproto/oauth-client-node` for identity linking
- Nostr adapter — `nostr-tools` (v2.23+) for event creation/signing, NDK for relay management, `hono-nostr-auth` for NIP-98
- Polycentric adapter — clean-room implementation (AGPL reference only), decentralized comment/discussion layer
- Protocol registry with feature flags — runtime enable/disable per protocol
- Common internal event interface — adapters translate between S/NC events and protocol-native formats
- Inbound normalization — external activities from any protocol mapped to internal domain events
