---
tags: [federation]
release_binding: null
created: 2026-04-20
---

# Federated Content Distribution

Pushing S/NC content outward to all enabled protocol networks — ActivityPub outbox dispatchers, AT Protocol PDS mirroring, Nostr NOM events, Polycentric comment anchoring, RSS/Atom syndication, IPFS CID provenance, and visibility-aware gating.

**Bullets to split / scope out when this is promoted:**

- Fedify dispatchers — push content to AP followers (outbox, Create/Note/Article activities)
- PDS repo — content mirrored to AT Protocol repository; auto-distributed via relay network; custom lexicons (`com.snc.media.*`)
- Nostr events — NOM (Nostr Open Media) spec for music/media; events signed with creator keypair
- Polycentric events — comment/discussion layer anchored to S/NC content URLs
- RSS/Atom baseline — protocol-independent syndication as lowest-common-denominator
- IPFS CIDs — hash content on ingest via Helia; store CIDs in PostgreSQL for provenance verification
- Visibility-aware federation — subscriber-only content not federated by default; creator opt-in per piece
