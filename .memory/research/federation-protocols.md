# Federation Protocols & Interoperability

**Status:** Draft
**Date:** 2026-03-05

Technical research on multi-protocol federation for the S/NC platform. Covers four federation protocols (ActivityPub, AT Protocol, Nostr, Polycentric), supplementary technologies (IndieAuth, IPFS, MusicBrainz, Matrix), and research-only topics (Podcasting 2.0/V4V, Verifiable Credentials, Open Payments/ILP). Informed by the platform's existing stack: Hono API + TanStack Start + PostgreSQL.

**Key decision:** S/NC account is the canonical identity. Protocol identities (AP actor, DID, Nostr pubkey, Polycentric keypair) are linked projections — not co-equal authorities. This simplifies moderation, content gating, and account recovery while still allowing members to bring external identities (e.g., existing Bluesky account).

**Protocol priority:** ActivityPub > AT Protocol > Nostr > Polycentric

---

## Federation Protocols

### ActivityPub (Priority 1)

The W3C standard for decentralized social networking. Largest existing federation (Mastodon, Lemmy, PeerTube, Pixelfed, etc.). Best reach for content distribution and follower growth.

**Core library: Fedify**

[Fedify](https://github.com/dahlia/fedify) is a TypeScript ActivityPub server framework. Version 2.0 ships modular packages:

| Package | Function |
|---------|----------|
| `@fedify/fedify` | Core framework — actors, inbox/outbox, dispatchers |
| `@fedify/vocab` | ActivityStreams/ActivityPub vocabulary types |
| `@fedify/hono` | Hono middleware integration — handles WebFinger, NodeInfo, HTTP Signatures, JSON-LD serialization, content negotiation |
| `@fedify/postgres` | KvStore + MessageQueue backed by PostgreSQL (uses S/NC's existing database) |

The `@fedify/hono` middleware plugs directly into the existing Hono API. No separate sidecar service needed — federation endpoints live alongside the existing API routes.

Fedify handles the hard parts of AP implementation: HTTP Signatures (draft-cavage-http-signatures-12), JSON-LD canonicalization, WebFinger (RFC 7033), NodeInfo, content negotiation (Accept headers for `application/activity+json` vs HTML), and inbox forwarding.

**Auth integration:** [Auth.js](https://authjs.dev/) ships a Mastodon provider for fediverse login. Users enter their instance URL, Auth.js handles the OAuth flow. This gives S/NC "Sign in with Mastodon/Fediverse" alongside existing auth.

**Project status:** Funded by Sovereign Tech Fund. Presented at FOSDEM 2026. Actively maintained, growing adoption (Hollo, Fedify Blog, etc.).

**License:** MIT — no restrictions.

**What Fedify gives S/NC:**
- AP actors for creators (outbox publishing, follower management)
- Inbox handling for follows, likes, boosts, replies from the fediverse
- WebFinger discovery (`@creator@s-nc.org`)
- NodeInfo for instance metadata
- PostgreSQL-backed message queue for reliable activity delivery

### AT Protocol (Priority 2)

The protocol behind Bluesky. Differs fundamentally from ActivityPub: account-portable by design (DIDs + signed data repos), global indexing via relay/appview architecture, no instance-level federation.

**Architecture: Self-hosted PDS (Personal Data Server)**

S/NC runs its own PDS as a sidecar service:
- Docker container, SQLite storage, ~1GB RAM
- Hosts AT Protocol repos for S/NC members
- Members get `@handle.s-nc.org` identity
- PDS auto-broadcasts to the relay network — no registration with Bluesky required
- Members can also bring existing Bluesky identities via OAuth

**Identity:**
- `did:plc` for PDS-hosted accounts (standard Bluesky DID method)
- `did:web` as alternative for domain-verified identity
- DID documents hosted at `/.well-known/did.json`

**OAuth integration:**

AT Protocol uses OAuth 2.1 with DPoP (Demonstrating Proof-of-Possession) + PKCE + PAR (Pushed Authorization Requests).

Libraries:
- `@atproto/oauth-client-node` — official SDK, server-side OAuth client
- `@tijs/atproto-oauth` — BFF (Backend-for-Frontend) pattern designed for Hono

This enables "Sign in with Bluesky" — members can link their existing Bluesky identity to their S/NC account, or use their PDS-hosted identity.

**Custom lexicons (future):** `com.snc.media.*` — AT Protocol's schema system allows defining custom record types. S/NC could define media-specific schemas that appviews can index.

**License:** MIT/Apache-2.0 — no restrictions.

### Nostr (Priority 3)

Simplest protocol of the four. JSON events signed with secp256k1 keys, relayed over WebSocket. No accounts, no instances — just keypairs and relays. Native payment rails via Lightning Network.

**Core libraries:**

| Library | Function |
|---------|----------|
| `nostr-tools` (v2.23+) | Event creation, signing, relay communication, NIP implementations |
| `@nostr-dev-kit/ndk` | High-level SDK — relay management, caching, subscription handling |
| `hono-nostr-auth` | NIP-98 HTTP auth middleware for Hono — direct integration |

**Identity:** Nostr public keys (npub). S/NC provides NIP-05 verification (`creator@s-nc.org` resolves to their Nostr pubkey via `/.well-known/nostr.json`).

**Payments — native Lightning integration:**
- NIP-57 (Zaps) — Lightning tips attached to events, visible as social proof
- NIP-47 (Nostr Wallet Connect / NWC) — wallet integration protocol; connect any NWC-compatible wallet (Alby, Mutiny, etc.)
- No Stripe needed for Nostr-native payments — Lightning is the payment rail

**Media:**
- Blossom (NIP-B7) — content-addressed media hosting (files identified by SHA-256 hash)
- NOM (Nostr Open Media) — community spec for music/media events on Nostr

**Bridging:** [Mostr](https://mostr.pub/) bridges Nostr to ActivityPub bidirectionally (production). S/NC's Nostr presence automatically gets AP visibility through Mostr, and vice versa.

**Why include Nostr despite lower priority:**
- Simplest to implement (no JSON-LD, no HTTP signatures, no DID infrastructure)
- Native micropayment rails align with S/NC's creator-payment mission
- Growing music community (Wavlake, Fountain, etc.)
- Free AP interop via Mostr bridge

**License:** `nostr-tools` is Unlicense (public domain). NDK is MIT.

### Polycentric (Priority 4)

Decentralized social protocol from FUTO. Uses cryptographic event logs signed by ed25519 keypairs. Multi-device support via cross-signed key chains. Primary real-world use: Grayjay comments.

**Library:** `@polycentric/polycentric-core` — **not published to npm**. Must be consumed from the [git monorepo](https://github.com/futo-org/polycentric). This is a significant integration friction point.

**Self-hosted server:** PostgreSQL + OpenSearch + Docker. Heavier infrastructure than the other protocols.

**Identity:** FUTO ID — cross-platform identity claims and trust graph. Users can link their Polycentric public key to other identities (including S/NC accounts).

**Integration pattern:** Most practical use for S/NC is as a decentralized comment/discussion layer anchored to content URLs. Polycentric events referencing S/NC content URLs become threaded discussions visible in the Polycentric network.

**Why lowest priority:**
- AGPL-3.0 license — clean-room adapter required; cannot copy or derive from Polycentric code in S/NC's MIT codebase
- Not on npm — integration requires git dependency management
- Least mature ecosystem — limited adoption beyond Grayjay
- Heaviest infrastructure requirements (OpenSearch)
- No bridges to other protocols

**License:** AGPL-3.0 — reference and study only. Any S/NC adapter must be clean-room implementation or isolated in a separate AGPL-licensed module.

---

## Supplementary Technologies

### IndieAuth

Federated domain-based login built on OAuth 2.0. Users authenticate with their own domain (e.g., `creator.example.com`). Relevant because it bridges identity systems — IndieAuth, ActivityPub, and AT Protocol all share the OAuth Client ID Metadata Documents spec (IETF).

**Integration:** Add as an auth option alongside Mastodon OAuth and AT Protocol OAuth. Users who own a domain can sign in with it. Low implementation cost — standard OAuth 2.0 flow with discovery via `rel="authorization_endpoint"` link headers.

### IPFS Content Addressing

Hash content on ingest to generate Content Identifiers (CIDs). Store CIDs in PostgreSQL alongside content records. Not for delivery — S/NC serves content directly from its own infrastructure.

**Library:** [Helia](https://github.com/ipfs/helia) — TypeScript IPFS implementation. Use only the hashing/CID-generation functions, not the full IPFS node.

**Purpose:** Content provenance and integrity verification. A CID proves a piece of content existed in a specific form at a specific time. Useful for:
- Proving original upload dates (copyright disputes)
- Verifying content hasn't been tampered with
- Future interop with content-addressed protocols (AT Protocol repos, Blossom/Nostr)

### MusicBrainz / ListenBrainz

[MusicBrainz](https://musicbrainz.org/) is the open music encyclopedia — persistent identifiers (MBIDs) for artists, releases, recordings, works. [ListenBrainz](https://listenbrainz.org/) is open listen tracking (like Last.fm but open-source).

**Library:** [`musicbrainz-api`](https://www.npmjs.com/package/musicbrainz-api) (v1.1.0) — typed TypeScript, ESM-compatible.

**Integration:**
- Submit S/NC Records releases to MusicBrainz on publication
- Store MBIDs in PostgreSQL alongside release/artist records
- Scrobble plays to ListenBrainz for open listen data
- Use MBIDs as stable cross-platform identifiers (Spotify, Apple Music, Discogs all reference MusicBrainz)

**Values alignment:** MetaBrainz Foundation is a nonprofit. Open data, community-maintained. Strong fit with S/NC's cooperative values.

### Matrix (Deferred)

Decentralized communication protocol. [Synapse](https://github.com/element-hq/synapse) is the reference homeserver.

**Use case:** Governance communications — member discussions, working group coordination, proposal deliberation. Maps well to S/NC's sub-org structure via Matrix Spaces.

**Why deferred:**
- Resource-heavy — Synapse needs 2-4GB RAM minimum
- No members yet who need governance comms
- Deploy when the cooperative has active members requiring structured governance communication
- Conduit/Dendrite (lighter servers) are maturing but not production-ready for S/NC's needs

---

## Research Only

Documented for future reference. Not in the feature backlog.

### Podcasting 2.0 / Value4Value

The `podcast:value` RSS tag encodes cooperative revenue splits directly into the feed. Lightning micropayments flow to split recipients via Nostr Wallet Connect or Alby. No intermediary takes a cut.

[Wavlake](https://wavlake.com/) proves the model works for music — artists receive Lightning payments directly from listeners. [Fountain](https://fountain.fm/) implements V4V for podcasts.

**Library:** [`podcast-partytime`](https://www.npmjs.com/package/podcast-partytime) — npm package for parsing Podcasting 2.0 RSS extensions.

**Relevance to S/NC:** Natural distribution channel for S/NC Podcast and potentially S/NC Records. The revenue split model maps directly to cooperative surplus distribution. Document as a future distribution channel when S/NC Podcast launches.

### W3C Verifiable Credentials

Design S/NC membership data model to be VC-compatible (member ID, class, date, issuer). Defer actual credential issuance until the ecosystem matures and there's demand. The membership data structure should be shaped so that wrapping it in a VC envelope later is straightforward.

### Open Payments / Interledger Protocol (ILP)

Vision-aligned — open protocol for sending payments across payment networks. Could enable protocol-agnostic creator payments. But no working revenue-sharing implementation exists today. The spec is largely theoretical for this use case. Monitor annually.

---

## Multi-Protocol Bridging

Existing bridges reduce the integration burden:

| Bridge | Protocols | Status |
|--------|-----------|--------|
| [Bridgy Fed](https://github.com/snarfed/bridgy-fed) | ActivityPub <-> AT Protocol | Production |
| [Mostr](https://mostr.pub/) | Nostr <-> ActivityPub | Production |
| *(none)* | Polycentric <-> anything | No bridges exist |

Bridgy Fed means S/NC's AP presence is automatically visible on Bluesky (and vice versa) without running a PDS. But running an own PDS gives S/NC more control over identity and custom lexicons. Both approaches can coexist.

Mostr means S/NC's Nostr events automatically federate to AP networks. This makes Nostr integration even more valuable — two protocols for the price of one.

---

## Architecture

### Identity Model

S/NC canonical identity with linked protocol projections:

```
S/NC Account (canonical)
  |-- AP Actor URI (via Fedify)
  |-- AT Protocol DID (via PDS or external)
  |-- Nostr pubkey (NIP-05 verified)
  |-- Polycentric public key (FUTO ID claim)
  |-- IndieAuth domain (optional)
```

Members can bring external identities (existing Bluesky account, existing Nostr keypair) and link them. The S/NC account remains authoritative for content gating, governance rights, and moderation.

### Infrastructure

| Component | Deployment | Storage |
|-----------|------------|---------|
| Fedify (AP) | In-process Hono middleware | PostgreSQL (existing) |
| PDS (AT Protocol) | Docker sidecar | SQLite (separate) |
| Nostr relay (optional) | Docker sidecar or external | PostgreSQL or flat files |
| Polycentric server (optional) | Docker sidecar | PostgreSQL + OpenSearch |

Fedify is the lightest integration — it runs inside the existing Hono process. The PDS is a small sidecar. Nostr can use external relays initially (no self-hosted relay needed). Polycentric requires the most infrastructure.

### Protocol Adapter Pattern

Common internal event interface:

```
Internal Event (new content, follow, reaction, etc.)
  |
  +-- AP Adapter (Fedify) -- handles AP-specific serialization, delivery
  +-- AT Adapter (@atproto SDK) -- handles PDS repo operations, lexicons
  +-- Nostr Adapter (nostr-tools/NDK) -- handles event signing, relay publishing
  +-- Polycentric Adapter (clean-room) -- handles event creation, server push
```

Each adapter translates between S/NC's internal event model and the protocol's native format. The adapter registry controls which protocols are active (feature flags). Inbound activities from any protocol are normalized into internal events.

### Key Libraries

| Library | Version | License | Protocol |
|---------|---------|---------|----------|
| `@fedify/fedify` | 2.x | MIT | ActivityPub |
| `@fedify/hono` | 2.x | MIT | ActivityPub |
| `@fedify/postgres` | 2.x | MIT | ActivityPub |
| `@atproto/oauth-client-node` | latest | MIT | AT Protocol |
| `nostr-tools` | 2.23+ | Unlicense | Nostr |
| `@nostr-dev-kit/ndk` | latest | MIT | Nostr |
| `hono-nostr-auth` | latest | MIT | Nostr |
| `@polycentric/polycentric-core` | git | AGPL-3.0 | Polycentric |
| `musicbrainz-api` | 1.1.0 | MIT | MusicBrainz |
| Helia (CID only) | latest | Apache-2.0/MIT | IPFS |

All libraries except `@polycentric/polycentric-core` are MIT/Apache/Unlicense — safe for S/NC's MIT codebase. Polycentric requires clean-room isolation.

---

## References

- [Fedify documentation](https://fedify.dev/)
- [AT Protocol specifications](https://atproto.com/)
- [Nostr NIPs](https://github.com/nostr-protocol/nips)
- [Polycentric source](https://github.com/futo-org/polycentric)
- [Bridgy Fed](https://fed.brid.gy/)
- [Mostr bridge](https://mostr.pub/)
- [Podcasting 2.0 namespace](https://github.com/Podcastindex-org/podcast-namespace)
- [Wavlake](https://wavlake.com/)
- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API)

*Last updated: 2026-03-05*
