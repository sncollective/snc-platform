# Nostr Protocol Research for S/NC Media Cooperative

**Status:** Research complete
**Date:** 2026-03-05

Technical deep-dive on Nostr protocol architecture, media distribution, Value4Value/zaps, comparison with ActivityPub/AT Protocol, TypeScript libraries, and integration complexity for S/NC. Complements `federation-protocols.md` with more granular library analysis and implementation estimates.

---

## 1. Nostr Architecture

### Core Design
Nostr (Notes and Other Stuff Transmitted by Relays) is a decentralized protocol built on four primitives: **keys, events, relays, and clients**.

### Identity (Keypairs)
- Identity is a **secp256k1 keypair** (same curve as Bitcoin)
- Private key: 64-char hex string, used to sign events
- Public key: derived 64-char hex string, serves as your identity
- Human-readable encoding: `npub1...` (public) and `nsec1...` (private) via bech32
- **NIP-05** maps keys to DNS-based identifiers (e.g., `alice@example.com`) for discoverability
- No server owns your identity -- you can use any client or relay without permission

### Events
All data on Nostr is a JSON blob called an **Event**. Every event has:
```json
{
  "id": "<sha256 hash of serialized event>",
  "pubkey": "<hex public key>",
  "created_at": "<unix timestamp>",
  "kind": "<integer event type>",
  "tags": [["e", "<event id>"], ["p", "<pubkey>"], ...],
  "content": "<arbitrary string>",
  "sig": "<schnorr signature>"
}
```
Event `kind` numbers define the type (e.g., kind 1 = short text note, kind 0 = profile metadata, kind 30023 = long-form content).

### Relays
- Simple WebSocket servers that store and forward events
- Clients connect to one or more relays via `wss://`
- Relays accept events (if they pass validation), store them, and broadcast to subscribers
- Clients send **filters** to subscribe to events matching criteria (by author, kind, tag, time range)
- No relay is authoritative -- users publish to multiple relays for redundancy
- Relay operators can set their own policies (paid, invite-only, topic-specific, etc.)

### NIPs (Nostr Implementation Possibilities)
NIPs are the spec documents governing the protocol. Key NIPs for S/NC:

| NIP | Title | Relevance |
|-----|-------|-----------|
| 01 | Basic protocol flow | Core -- events, subscriptions, relay communication |
| 02 | Follow List | Social graph |
| 05 | DNS-based identifiers | Human-readable names for members |
| 17 | Private Direct Messages | Member communication |
| 23 | Long-form Content | Articles, blog posts |
| 25 | Reactions | Engagement signals |
| 28 | Public Chat | Group discussion |
| 29 | Relay-based Groups | Cooperative working groups |
| 32 | Labeling | Content categorization |
| 42 | Client Authentication | Relay access control |
| 47 | Wallet Connect (NWC) | Payment integration |
| 51 | Lists | Curated collections |
| 57 | Lightning Zaps | Creator payments |
| 65 | Relay List Metadata | Outbox model |
| 68 | Picture-first feeds | Visual media |
| 71 | Video Events | Video distribution |
| 72 | Moderated Communities | Community governance |
| 75 | Zap Goals | Crowdfunding targets |
| 92 | Media Attachments | Inline media |
| 94 | File Metadata | File descriptions |
| 96 | HTTP File Storage | (deprecated, use Blossom) |
| 98 | HTTP Auth | Server authentication |
| B7 | Blossom media | Decentralized file hosting |

---

## 2. Media Distribution on Nostr

### Blossom (NIP-B7) -- Decentralized File Hosting
Blossom (Blobs Stored Simply on Mediaservers) is the current standard for media hosting:
- Files are addressed by their **SHA-256 hash**, making them content-addressable
- Users publish a list of their Blossom servers (like declaring "my files live here")
- If a file URL fails, clients fall back to the user's declared Blossom servers
- Files can be mirrored across multiple servers for redundancy
- If a file is removed from one server, upload to another, update your server list, and all existing notes still display correctly
- Authentication uses Nostr event signatures (no separate auth system)
- **NIP-96** (HTTP File Storage) is deprecated in favor of Blossom

**Services**: nostr.build, nostrmedia.com, blossom.band, blosstr.com

### Nostr Open Media (NOM) Specification
Created by Wavlake, NOM defines a minimal event schema for multimedia:
- Uses **Parameterized Replaceable Events** (so metadata can be updated)
- Fields: `title`, `guid`, `creator`, `type` (MIME), `duration` (seconds), `published_at`, `link`, `enclosure` (direct file URL), `version`
- Intentionally excludes DRM and payment logic -- keeps it simple
- Mirrors podcast RSS structure adapted for Nostr

### Video Events (NIP-71)
Dedicated event kind for video content with metadata tags.

### Music Distribution: Wavlake
Wavlake is the leading Nostr-native music platform:
- Artists upload music; it's published as Nostr events with NOM metadata
- Listeners can **zap** (tip) artists directly while listening
- Uses Lightning Network for instant Bitcoin micropayments
- No middlemen -- artists receive payments directly
- Music is accessible from any NOM-compatible Nostr client
- Also supports podcasts via Podcasting 2.0 (RSS) standard

### Other Media Clients
- **zap.stream** -- live streaming on Nostr with zap integration
- **olas** -- image/photo sharing
- **Wavman** -- dedicated music player that consumes NOM events

### Playlist Support (Proposed)
A proposed NIP would embed M3U/M3U8 playlist data in event content fields, enabling shared mixtapes, community radio, and curated media queues.

### Zapwall (Paywalls)
Some Blossom servers support "Zapwall" -- a paywall requiring a Lightning zap to unlock files, with payments going directly to the file owner.

---

## 3. Value4Value / Zaps

### How Zaps Work (NIP-57)
Zaps are Bitcoin Lightning Network payments attached to Nostr events:

1. **Zap Request (kind 9734)**: Payer's client creates a signed event requesting an invoice from the recipient's Lightning wallet
2. **LNURL Resolution**: The recipient's profile includes a Lightning address (via LNURL or NIP-57 metadata); the payer's client contacts this endpoint
3. **Invoice Generation**: Recipient's wallet/service generates a Lightning invoice
4. **Payment**: Payer pays the invoice via Lightning
5. **Zap Receipt (kind 9735)**: The Lightning wallet publishes a receipt event on Nostr, proving payment was made
6. **Display**: Clients see the zap on the original note/profile, showing amount and sender

Payments are in **sats** (satoshis; 1 BTC = 100,000,000 sats). Typical zaps range from 1 sat to thousands of sats.

### Nostr Wallet Connect (NIP-47)
NWC enables clients to access a remote Lightning wallet:
- Wallet generates a `nostr+walletconnect://` URI
- Communication happens via encrypted Nostr DMs between client and wallet
- Supports operations: `pay_invoice`, `get_balance`, `make_invoice`, `list_transactions`
- Enables seamless in-app payments without exposing wallet credentials

### Cashu Integration (NIP-60, NIP-61)
- NIP-60: Cashu eCash wallet events (bearer tokens on Nostr)
- NIP-61: "Nutzaps" -- zaps using Cashu tokens instead of Lightning
- Enables offline-capable payments and lower fee structures

### Scale and Adoption
- Over 5 million zaps sent as of May 2025
- 4.4+ million creators indexed in the V4V ecosystem
- 25,000+ creators have implemented value-enabling features

### Relevance for S/NC
The V4V model aligns directly with cooperative values:
- **No intermediaries** -- artists/creators receive payments directly
- **No advertising model** -- content is free, payment is voluntary
- **Instant settlement** -- Lightning payments confirm in seconds
- **Micropayments viable** -- fractions of a cent are practical
- **Transparent** -- zap receipts are public, auditable events

---

## 4. Nostr vs AT Protocol vs ActivityPub

### Architecture Comparison

| Dimension | Nostr | ActivityPub (Fediverse) | AT Protocol (Bluesky) |
|-----------|-------|------------------------|----------------------|
| **Communication model** | Client-to-relay (WebSocket) | Server-to-server (HTTP) | Client-to-PDS, PDS-to-relay |
| **Identity** | Cryptographic keypair | Server-based (`@user@instance`) | DID-based, but server-managed |
| **Data format** | JSON events with signatures | JSON-LD Activity objects | CBOR records in repositories |
| **Data ownership** | User holds private key | Server admin controls | Theoretically portable, practically server-dependent |
| **Censorship resistance** | Strongest -- key-based identity, relay redundancy | Moderate -- admin controls per instance | Weakest in practice -- Bluesky is highly centralized |
| **Payment integration** | Native (Zaps, NWC, Cashu) | None built-in | None built-in |
| **Spec maturity** | Evolving (NIPs process) | W3C Recommendation (mature) | Evolving |
| **Adoption** | Growing (Bitcoin/crypto community) | Large (Mastodon, Misskey, Pixelfed, Threads) | Large (Bluesky ~20M+ users) |
| **Implementation complexity** | **Lowest** -- simple JSON + WebSocket | **Highest** -- HTTP signatures, JSON-LD, server federation | **Medium** -- DID resolution, CBOR, lexicons |

### Bridges Between Protocols

**Mostr (Nostr <-> ActivityPub)**
- Bidirectional bridge between Nostr and the Fediverse
- Has an ActivityPub inbox that converts data to Nostr events and pushes to relay
- Listens on relay and federates ActivityPub data for Nostr events
- Supports zaps across the bridge (Fediverse users can zap Nostr users)
- Can follow Threads accounts from Nostr via Mostr
- Status: functional but evolving, maintained by Soapbox

**Bridgy Fed (Fediverse <-> Bluesky <-> Web)**
- Bridges ActivityPub and AT Protocol bidirectionally
- Does NOT directly support Nostr yet (on roadmap)
- Nostr users can reach Bluesky indirectly: Nostr -> Mostr -> Fediverse -> Bridgy Fed -> Bluesky

**nipy-bridge (Nostr <-> AT Protocol <-> ActivityPub)**
- A local bridge project attempting to connect all three protocols
- Less mature than Mostr or Bridgy Fed

### Strategic Implications for S/NC
- Nostr is the only protocol with **native payment rails** -- critical for a media cooperative
- ActivityPub has the **largest federated network** and most mature tooling
- AT Protocol has **mainstream user adoption** via Bluesky
- Bridges exist to connect them, though they are imperfect
- A pragmatic approach: build Nostr-native for payments/identity, bridge to Fediverse for reach

---

## 5. TypeScript/Node.js Libraries

### nostr-tools (Low-Level)
- **npm**: `nostr-tools` (v2.23.3+)
- **GitHub**: github.com/nbd-wtf/nostr-tools
- **Purpose**: Core protocol library for building Nostr clients
- **Requirements**: TypeScript >= 5.0
- **Features**:
  - Event creation, validation, signing
  - WebSocket relay communication (with auto-reconnect, heartbeat pings)
  - Key generation and management
  - NIP implementations (encryption, zaps, etc.)
  - Pure JS and WASM crypto backends
- **Best for**: Building custom Nostr integrations into existing apps

### NDK -- Nostr Development Kit (High-Level)
- **npm**: `@nostr-dev-kit/ndk` (v2.14.33+)
- **GitHub**: github.com/nostr-dev-kit/ndk
- **Purpose**: Comprehensive toolkit for full Nostr applications
- **Features**:
  - Reactive UI bindings (Svelte 5, React, React Native)
  - Web of Trust
  - Negentropy sync (efficient relay synchronization)
  - Multi-account sessions
  - Wallet integration (`@nostr-dev-kit/ndk-wallet` for NIP-47, NIP-57, NIP-60)
  - Flexible caching (Dexie, Redis, SQLite, in-memory, relay-backed)
  - Outbox model support
  - Event wrappers for major NIPs
- **Best for**: Building full-featured Nostr clients or platforms

### Nostrify (Framework-Level)
- **npm/JSR**: `@nostrify/*` packages
- **Website**: nostrify.dev
- **Maintainer**: Soapbox (creators of Mostr bridge and Ditto relay)
- **Features**:
  - Cross-platform (browser, Node.js, Deno, mobile)
  - Relay management with auto-reconnect
  - Storage abstraction (memory, SQL, relay -- same interface)
  - Signers (private key, hardware wallet, remote signing)
  - **Composable policy pipelines** for relay moderation
  - Event validation and parsing
  - Outbox model support
- **Best for**: Building Nostr relays, server-side Nostr services, or platforms needing relay-like functionality

### hono-nostr-auth (Hono Middleware)
- **npm**: `hono-nostr-auth`
- **Purpose**: NIP-98 HTTP authentication middleware for Hono
- **Usage**:
  ```typescript
  import { Hono } from "hono";
  import { nostrAuth, type NostrEvent } from "hono-nostr-auth";

  const app = new Hono<{ Variables: { nostrAuthEvent: NostrEvent } }>();
  app.use("/api/*", nostrAuth({ maxCreatedAtDiffSec: 60 }));
  app.get("/api/me", (c) => {
    const authEv = c.get("nostrAuthEvent");
    return c.text(`Hello, ${authEv.pubkey}!`);
  });
  ```
- **Directly relevant**: S/NC platform uses Hono

### Nostr Connect SDK
- **GitHub**: github.com/nostr-connect/connect
- **Purpose**: Integrate Nostr Connect (remote signing) into web apps
- **Use case**: Let users authenticate with their Nostr identity without exposing keys

### Relay Implementations (TypeScript)

**Nostream**
- **GitHub**: github.com/cameri/nostream
- TypeScript relay backed by PostgreSQL
- Docker-packaged, production-ready
- Requires PostgreSQL + Redis

**Ditto (by Soapbox)**
- Built on Nostrify
- Full social media server that speaks both Nostr and ActivityPub
- Has built-in moderation policies

---

## 6. Integration Complexity Assessment

### Nostr Integration into the S/NC Platform (Hono API + TanStack Start)

#### Effort Level: MODERATE (2-4 weeks for core, ongoing for advanced features)

#### Minimal Integration (1-2 weeks)
1. **Nostr identity login**: Let users authenticate via NIP-07 (browser extension) or NIP-46 (remote signer). Use `hono-nostr-auth` middleware for NIP-98 HTTP auth.
2. **Publish platform events to Nostr**: When content is created on the platform, also publish it as a Nostr event to one or more relays. Use `nostr-tools` for event creation/signing.
3. **Read Nostr events**: Subscribe to relays to pull in relevant events (e.g., zap receipts, comments from Nostr users).

#### Medium Integration (2-4 weeks)
4. **Zap integration**: Display Lightning addresses for creators. Show zap receipts from Nostr. Integrate NWC (NIP-47) for in-platform tipping.
5. **Media publishing**: Publish music/video as NOM-compatible events. Use Blossom for file hosting with SHA-256 addressable files.
6. **Profile federation**: Sync platform profiles with Nostr profile events (kind 0).

#### Full Integration (4-8 weeks)
7. **Run a relay**: Operate a Nostr relay for cooperative members (Nostream for TypeScript/PostgreSQL, or Ditto for Nostr+ActivityPub).
8. **ActivityPub bridge**: Use Mostr or Ditto to also federate to the Fediverse.
9. **Cooperative governance on Nostr**: Use NIP-29 (relay-based groups) or NIP-72 (moderated communities) for governance discussions.

### Comparison: Integration Effort by Protocol

| Aspect | Nostr | ActivityPub | AT Protocol |
|--------|-------|-------------|-------------|
| **Add identity/login** | Easy (keypair + NIP-07) | Medium (WebFinger, HTTP signatures) | Medium (DID resolution, OAuth) |
| **Publish content** | Easy (sign JSON, POST to relay) | Hard (JSON-LD, deliver to followers' inboxes) | Medium (create records in PDS) |
| **Receive content** | Easy (WebSocket subscription) | Medium (implement inbox endpoint) | Medium (subscribe to firehose) |
| **Payments** | Built-in (zaps, NWC) | Not built-in (need external) | Not built-in (need external) |
| **File hosting** | Moderate (Blossom) | Separate concern | Separate concern |
| **Run your own server** | Easy (relay is simple) | Hard (full server implementation) | Hard (PDS is complex) |
| **Existing Hono support** | Yes (`hono-nostr-auth`) | No specific middleware | No specific middleware |
| **Library maturity** | Good (nostr-tools, NDK) | Good (many implementations) | Good (official @atproto packages) |

### Key Advantages of Nostr for S/NC
1. **Native payments** -- the only protocol with built-in payment rails (Lightning/zaps)
2. **Simplest protocol** -- JSON events over WebSocket, no JSON-LD, no complex federation
3. **True data ownership** -- keypair identity, no server lock-in
4. **Hono middleware exists** -- `hono-nostr-auth` for NIP-98
5. **Cooperative-aligned** -- no central authority, V4V model matches cooperative economics
6. **Media ecosystem growing** -- Wavlake, zap.stream, Blossom all production-ready

### Key Risks / Limitations
1. **Smaller user base** than Fediverse or Bluesky (though growing)
2. **Bitcoin/Lightning dependency** -- payments require Lightning Network infrastructure
3. **No built-in content moderation** -- must implement at relay level
4. **Relay economics** -- running relays costs money; no built-in incentive model yet
5. **Bridge quality** -- Mostr works but is imperfect; cross-protocol UX is lossy
6. **Media hosting** -- Blossom is young; no guaranteed persistence without running your own server

---

## Recommendation for S/NC

Nostr is the strongest protocol fit for a media production/distribution cooperative because of its native payment integration, simple architecture, and alignment with cooperative values (no intermediaries, user-owned identity, censorship resistance). The TypeScript ecosystem is mature enough for production use, and there is a direct Hono integration path.

**Suggested approach:**
1. Start with Nostr identity (NIP-07/NIP-46) and `hono-nostr-auth` in the existing Hono API
2. Publish media content as NOM-compatible Nostr events
3. Integrate zaps (NIP-57) and NWC (NIP-47) for creator payments
4. Use Blossom for decentralized media file hosting
5. Bridge to ActivityPub via Mostr or Ditto for broader reach
6. Consider running a cooperative relay for member content

---

## Sources

### Protocol Architecture
- [The Nostr Protocol](https://nostr.how/en/the-protocol)
- [Nostr's Technical Architecture](https://onnostr.substack.com/p/nostrs-technical-architecture-the)
- [NIP-01 Basic Protocol](https://nips.nostr.com/1)
- [Nostr Wikipedia](https://en.wikipedia.org/wiki/Nostr)
- [How Nostr Works Technical Deep-Dive](https://nostr.co.uk/learn/how-nostr-works/)
- [NIPs Repository](https://github.com/nostr-protocol/nips)

### Media Distribution
- [NIP-B7 Blossom Media](https://nips.nostr.com/B7)
- [Wavlake NOM Spec](https://github.com/wavlake/nom-spec)
- [Blossom Protocol Overview](https://onnostr.substack.com/p/the-blossom-protocol-supercharging)
- [Wavlake Beginner's Guide](https://onnostr.substack.com/p/a-beginners-guide-to-wavlake-empowering)
- [Value for Value Music with Lightning](https://zine.wavlake.com/value-for-value-music-with-lightning-what-a-concept/)
- [How We Built Wavman](https://zine.wavlake.com/how-we-built-wavman/)
- [M3U Playlists over Nostr Proposal](https://github.com/nostr-protocol/nips/issues/1945)

### Payments
- [Value for Value Explained](https://paywithflash.com/value-for-value-v4v-explained/)
- [What Are Zaps](https://nostr.how/en/zaps)
- [NIP-57 Lightning Zaps](https://github.com/nostr-protocol/nips/blob/master/57.md)
- [NIP-47 Wallet Connect](https://nips.nostr.com/47)
- [5 Million Zaps Milestone](https://onnostr.substack.com/p/nostrs-zap-boom-how-5-million-zaps)

### Protocol Comparison & Bridges
- [Nostr vs Fediverse vs Bluesky (Soapbox)](https://soapbox.pub/blog/comparing-protocols/)
- [Comparing Protocols (GIGAZINE)](https://gigazine.net/gsc_news/en/20240409-at-protocol-activitypub-nostr)
- [Mostr Bridge Introduction](https://soapbox.pub/blog/mostr-fediverse-nostr-bridge/)
- [Mostr Supports Zaps](https://www.nobsbitcoin.com/mostr-bridge-zaps/)
- [Bridgy Fed Documentation](https://fed.brid.gy/docs)
- [Follow Bluesky from Nostr](https://soapbox.pub/blog/follow-bluesky/)
- [nipy-bridge](https://github.com/0n4t3/nipy-bridge)

### TypeScript Libraries
- [nostr-tools (npm)](https://www.npmjs.com/package/nostr-tools)
- [nostr-tools (GitHub)](https://github.com/nbd-wtf/nostr-tools)
- [NDK Nostr Development Kit](https://github.com/nostr-dev-kit/ndk)
- [NDK npm](https://www.npmjs.com/package/@nostr-dev-kit/ndk)
- [Nostrify Framework](https://nostrify.dev/)
- [hono-nostr-auth](https://github.com/jiftechnify/hono-nostr-auth)
- [Nostr Connect SDK](https://github.com/nostr-connect/connect)
- [Nostream Relay (TypeScript)](https://github.com/cameri/nostream)
- [Awesome Nostr](https://github.com/aljazceru/awesome-nostr)

*Last updated: 2026-03-05*
