# Research: Podcasting 2.0, Value4Value, and the Podcast Namespace

**Status:** Research complete
**Date:** 2026-03-05

Technical research for S/NC (Signal to Noise Collective) — a multi-stakeholder platform cooperative for media production and distribution. This research covers Podcasting 2.0 namespace tags, Value4Value payments, split payment mechanisms, web platform integration, music-specific features, and existing platforms in the space.

---

## 1. Podcasting 2.0 Namespace — Complete Tag Reference

The podcast namespace (`xmlns:podcast="https://podcastindex.org/namespace/1.0"`) is an open RSS namespace maintained by the Podcast Index organization. Tags are adopted in numbered "phases" and considered locked once formalized. The specification is CC0 (public domain).

### Phase 1 (Formalized 2020-11-15)
| Tag | Level | Purpose |
|-----|-------|---------|
| `<podcast:locked>` | Channel | Controls whether other platforms may import the feed |
| `<podcast:transcript>` | Item | Links to transcript files (SRT, VTT, JSON, plain text) |
| `<podcast:funding>` | Channel | URL + text for donation/support pages |
| `<podcast:chapters>` | Item | Links to JSON chapters file (artwork, URLs, titles per chapter) |
| `<podcast:soundbite>` | Item | Highlights notable audio segments (startTime, duration, title) |

### Phase 2 (Formalized 2021-01-31)
| Tag | Level | Purpose |
|-----|-------|---------|
| `<podcast:person>` | Channel/Item | Credits contributors with roles, groups, images, URLs |
| `<podcast:location>` | Channel/Item | Geographic info (geo URI, OSM reference, name) |
| `<podcast:season>` | Item | Season number and name |
| `<podcast:episode>` | Item | Episode number and display text |

### Phase 3 (Formalized 2021-06-01)
| Tag | Level | Purpose |
|-----|-------|---------|
| `<podcast:trailer>` | Channel | Promotional content (URL, pubdate, season, length, type) |
| `<podcast:license>` | Channel/Item | Content license (SPDX identifier or URL) |
| `<podcast:alternateEnclosure>` | Item | Alternate media formats (with nested `<podcast:source>` and `<podcast:integrity>`) |
| `<podcast:guid>` | Channel | Global unique identifier for the podcast (UUID v5) |

### Phase 4 (Formalized 2021-12-01)
| Tag | Level | Purpose |
|-----|-------|---------|
| `<podcast:value>` | Channel/Item | **Cryptocurrency/payment layer designation** — the core V4V tag |
| `<podcast:medium>` | Channel | Content type: podcast, **music**, video, film, audiobook, newsletter, blog, publisher, course |
| `<podcast:images>` | Channel/Item | Multiple image specification (srcset-like) |
| `<podcast:liveItem>` | Channel | Live streaming event metadata |

### Phase 5 (Formalized 2022-07-15)
| Tag | Level | Purpose |
|-----|-------|---------|
| `<podcast:socialInteract>` | Item | Social engagement / comments integration (ActivityPub, Twitter, etc.) |
| `<podcast:block>` | Channel | Platform exclusion controls |

### Phase 6 (Formalized 2023-06-01)
| Tag | Level | Purpose |
|-----|-------|---------|
| `<podcast:txt>` | Channel/Item | Arbitrary key-value text metadata |
| `<podcast:remoteItem>` | (nested) | Cross-feed content inclusion (feedGuid + itemGuid) |
| `<podcast:podroll>` | Channel | Podcast recommendations |
| `<podcast:updateFrequency>` | Channel | Publishing schedule indication |
| `<podcast:podping>` | Channel | Feed update notification mechanism |
| `<podcast:valueTimeSplit>` | Item (nested in value) | **Time-based payment split changes during playback** |

### Phase 7 (Formalized 2024-07-01)
| Tag | Level | Purpose |
|-----|-------|---------|
| `<podcast:publisher>` | Channel | Publishing entity attribution |
| `<podcast:chat>` | Channel | Live chat platform integration |

### Phase 8 (Current)
| Tag | Level | Purpose |
|-----|-------|---------|
| `<podcast:image>` | Channel/Item | Single image specification |

**Specification:** https://github.com/Podcastindex-org/podcast-namespace
**Docs site:** https://podcasting2.org/docs/podcast-namespace

---

## 2. Value4Value (V4V) Model — How It Works

### Concept

Value4Value is a monetization philosophy: content is provided freely, and consumers voluntarily send back value proportional to what they received. No paywalls, no subscriptions, no ads required. Payment flows directly from listener to creator.

### Technical Implementation: The `<podcast:value>` Tag

```xml
<podcast:value type="lightning" method="keysend" suggested="0.00000015000">
  <podcast:valueRecipient
    name="Host"
    type="node"
    address="02d5c1bf8b940dc9cadca86d1b0a3c37fbe39cee4c7e839e33bef9174531d27f52"
    split="90" />
  <podcast:valueRecipient
    name="Hosting Service"
    type="node"
    address="03ae9f91a0cb8ff43840e3c322c4c61f019d8c1c3cea15a25cfc425ac605e61a4a"
    split="10"
    fee="true" />
</podcast:value>
```

**`<podcast:value>` attributes:**
- `type` — Protocol layer (e.g., `"lightning"` for Bitcoin Lightning Network)
- `method` — Transport mechanism (e.g., `"keysend"` for LN keysend payments)
- `suggested` — Optional suggested payment amount (in BTC denomination)

**`<podcast:valueRecipient>` attributes:**
- `name` — Human-readable recipient name
- `type` — Address format (e.g., `"node"` for Lightning node pubkey)
- `address` — The recipient's payment address (Lightning node public key)
- `split` — Integer representing proportional share (not a percentage — relative to sum of all splits)
- `fee` — Boolean (default false). When true, this recipient's share is deducted first as a service fee before remaining funds are distributed among non-fee recipients
- `customKey` — Optional metadata key sent with payment
- `customValue` — Optional metadata value sent with payment

### Payment Types

1. **Streaming sats** — Continuous micropayments sent per minute of listening. A listener sets a "sats per minute" rate; the app sends keysend payments to the value recipients every ~60 seconds.
2. **Boosts** — One-time voluntary payments of any amount.
3. **Boostagrams** — Boosts that include a text message from the listener.

### How Splits Work (Critical for Cooperatives)

Splits are **proportional**, not percentage-based. If four recipients have splits of 40, 40, 15, and 5:
- Total shares = 100
- Each receives their share/total (40%, 40%, 15%, 5%)

But if splits were 80, 80, 30, 10:
- Total shares = 200
- Same proportions apply (40%, 40%, 15%, 5%)

**Fee recipients** are deducted first. If a fee recipient has `split="5"` and `fee="true"`, that 5% is taken off the top before the remaining 95% is distributed among non-fee recipients proportionally.

**Item-level overrides channel-level:** A `<podcast:value>` block at the `<item>` level completely replaces the channel-level value block for that episode, enabling per-episode payment customization.

---

## 3. Split Payments for Cooperatives

### Direct Applicability to S/NC

The `<podcast:value>` system was designed for exactly this kind of use case. A cooperative can:

1. **Define organizational splits at the channel level** — e.g., 50% to creators, 10% to S/NC operations fund, 5% to solidarity fund, etc.
2. **Override per episode** — When a guest appears or a collaborator contributes, the item-level value block can add them.
3. **Support up to 25 recipients** per value block (RSS Blue's documented limit, though the spec itself has no hard limit).

### Example: Cooperative Podcast Feed

```xml
<!-- Channel-level: default splits for all episodes -->
<podcast:value type="lightning" method="keysend">
  <podcast:valueRecipient name="S/NC Operations" type="node" address="..." split="10" fee="true" />
  <podcast:valueRecipient name="Host A (Worker Member)" type="node" address="..." split="45" />
  <podcast:valueRecipient name="Host B (Worker Member)" type="node" address="..." split="45" />
</podcast:value>

<!-- Item-level: episode with guest -->
<item>
  <podcast:value type="lightning" method="keysend">
    <podcast:valueRecipient name="S/NC Operations" type="node" address="..." split="10" fee="true" />
    <podcast:valueRecipient name="Host A" type="node" address="..." split="35" />
    <podcast:valueRecipient name="Host B" type="node" address="..." split="35" />
    <podcast:valueRecipient name="Guest (Contributor Member)" type="node" address="..." split="20" />
  </podcast:value>
</item>
```

### ValueTimeSplit — Time-Based Splits

The `<podcast:valueTimeSplit>` tag enables different payment recipients for different segments of an episode. This is transformative for cooperative media:

```xml
<podcast:value type="lightning" method="keysend">
  <!-- Default recipients for the show -->
  <podcast:valueRecipient name="Host" type="node" address="..." split="90" />
  <podcast:valueRecipient name="S/NC" type="node" address="..." split="10" fee="true" />

  <!-- Minutes 5:00-9:30: Music played from another artist's feed -->
  <podcast:valueTimeSplit startTime="300" duration="270" remotePercentage="95">
    <podcast:remoteItem
      feedGuid="a94f5cc9-8c58-55fc-91fe-a324087a655b"
      itemGuid="https://podcastindex.org/podcast/4148683#1"
      medium="music" />
  </podcast:valueTimeSplit>

  <!-- Minutes 20:00-26:28: Interview segment with local recipients -->
  <podcast:valueTimeSplit startTime="1200" duration="388">
    <podcast:valueRecipient name="Host" type="node" address="..." split="50" />
    <podcast:valueRecipient name="Guest Artist" type="node" address="..." split="50" />
  </podcast:valueTimeSplit>
</podcast:value>
```

**Key attributes:**
- `startTime` — Seconds when this split activates
- `duration` — How long (seconds) this split is active
- `remotePercentage` — When using `<podcast:remoteItem>`, what % goes to the remote feed's value recipients (0-100, default 100)
- `remoteStartTime` — Offset in the remote item for metadata alignment

**Processing rules:**
- Fee recipients from the parent value block are always deducted first
- Nested valueTimeSplit tags inside remoteItems are ignored
- When the time split period ends, payments revert to the parent value block recipients

### Cooperative Use Cases

| Scenario | Implementation |
|----------|---------------|
| Podcast plays S/NC Records artist's song | `valueTimeSplit` with `remoteItem` pointing to artist's music RSS feed |
| Multi-host show with rotating hosts | Per-episode `<podcast:value>` blocks adjusting splits |
| Revenue share with solidarity fund | Fee recipient for cooperative fund on every feed |
| Guest interview revenue sharing | `valueTimeSplit` for interview segment with guest's wallet |
| DJ mix show | Multiple `valueTimeSplit` blocks, one per track, each with `remoteItem` |

---

## 4. Web Platform Integration

### RSS Feed Generation

The S/NC platform needs to **generate** Podcasting 2.0-compliant RSS feeds. Key approaches:

**Option A: Custom RSS generation (recommended for S/NC)**
Build RSS XML directly in the Hono API. The podcast namespace is just XML — add the namespace declaration and emit the tags. This gives full control over value blocks, time splits, etc.

```xml
<rss version="2.0"
  xmlns:podcast="https://podcastindex.org/namespace/1.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
```

**Option B: Use existing npm packages**
- `podcast` (npm) — Node.js RSS generator, supports custom namespaces
- `feed` (npm) — TypeScript RSS/Atom/JSON Feed generator, extensible

**Option C: podcast-partytime for parsing inbound feeds**
- Parse external podcast feeds to display/aggregate content
- TypeScript library, supports all namespace phases
- Has `value-helpers.ts` for value tag processing

### RSS Feed Parsing (podcast-partytime)

```typescript
import { parseFeed } from "podcast-partytime";

const xml = await fetch(feedUrl).then(r => r.text());
const feed = parseFeed(xml);
// feed.pc20support — which phases the feed implements
// feed.value — parsed value block with recipients
// feed.items[].chapters, .transcripts, .persons, etc.
```

**Library details:**
- Package: `podcast-partytime` (v4.9.1)
- Written in TypeScript (99.3% TS)
- Implements phases 1-7 + pending
- Has dedicated `value-helpers.ts` for value tag processing
- Source: https://github.com/RyanHirsch/partytime

### Podcast Index API

The Podcast Index provides a free REST API for podcast discovery and metadata:
- **Search:** `/api/1.0/search/byterm`, `/api/1.0/search/bytitle`
- **Episodes:** `/api/1.0/episodes/byfeedurl`, `/api/1.0/episodes/byfeedid`
- **Recent:** `/api/1.0/recent/feeds` — recently updated feeds
- **Add:** `/api/1.0/add/byfeedurl` — register a feed in the index
- **Value:** The API returns value tag data for indexed feeds
- Auth: API key + secret pair (free developer accounts)
- Docs: https://podcastindex-org.github.io/docs-api/
- Node.js client: `podcast-index-api` (npm)

### Lightning Payment Integration

For the web platform to **process** V4V payments (not just declare them in RSS):

**Nostr Wallet Connect (NWC) — recommended approach:**
- Protocol: NIP-47
- JS SDK: `@getalby/sdk` or NWC JS SDK
- How it works: User connects their Lightning wallet via a connection string; the app can then request payments through a Nostr relay
- The wallet holder retains control — they approve transactions
- Alby Hub provides a self-custodial node that implements NWC

**WebLN (browser extension API):**
- Standard browser API for Lightning wallets
- `window.webln.sendPayment(invoice)`, `window.webln.keysend({...})`
- Alby browser extension implements WebLN
- NWC SDK aims for API compatibility with WebLN

**Integration architecture for S/NC platform:**
1. RSS feeds declare `<podcast:value>` with member wallets and cooperative splits
2. Web player implements streaming sats via NWC/WebLN
3. Platform manages value block generation based on contributor database
4. Splits are auto-calculated from contributor agreements stored in the platform

### Feed Registration

After generating RSS feeds, register them with:
1. **Podcast Index** — via API (`/api/1.0/add/byfeedurl`) or manual submission
2. **Podping** — real-time feed update notifications (decentralized, blockchain-based)
3. Traditional directories (Apple Podcasts, Spotify) — via standard RSS submission

---

## 5. Music-Specific Features

### `<podcast:medium>` for Music

The `medium` tag explicitly supports `"music"` as a value. When set:
- Apps may adjust playback speed to 1x (vs. spoken-word speed options)
- EQ settings optimize for music rather than voice
- UI adapts (album art, track listing vs. episode listing)
- A music feed represents "an album with each item a song within the album"

**List variants:** `musicL` designates a curated playlist/collection of music from multiple sources.

### Music RSS Feed Structure

```xml
<rss version="2.0" xmlns:podcast="https://podcastindex.org/namespace/1.0">
  <channel>
    <title>Album Title</title>
    <podcast:medium>music</podcast:medium>
    <podcast:guid>uuid-for-this-album</podcast:guid>
    <podcast:value type="lightning" method="keysend">
      <podcast:valueRecipient name="Band" type="node" address="..." split="85" />
      <podcast:valueRecipient name="S/NC Records" type="node" address="..." split="10" fee="true" />
      <podcast:valueRecipient name="Producer" type="node" address="..." split="5" />
    </podcast:value>
    <item>
      <title>Track 1</title>
      <enclosure url="https://cdn.example.com/track1.mp3" length="..." type="audio/mpeg" />
      <podcast:transcript url="https://example.com/lyrics1.txt" type="text/plain" language="en" rel="lyrics" />
      <podcast:person role="artist" name="Lead Singer" />
      <podcast:person role="producer" name="Producer Name" />
      <podcast:chapters url="https://example.com/chapters1.json" type="application/json+chapters" />
    </item>
    <!-- more tracks -->
  </channel>
</rss>
```

### Music-Relevant Tags

| Tag | Music Use Case |
|-----|---------------|
| `podcast:medium` | Set to `"music"` for albums/singles |
| `podcast:value` | Direct lightning payments to artists/label/producer |
| `podcast:valueTimeSplit` | Per-track splits in compilations or DJ mixes |
| `podcast:transcript` | Lyrics (rel="lyrics" convention) |
| `podcast:person` | Credits: artist, songwriter, producer, engineer, etc. |
| `podcast:chapters` | Track segments, movements, sections |
| `podcast:alternateEnclosure` | Multiple quality levels (FLAC, MP3, Opus) |
| `podcast:license` | Creative Commons, custom licenses |
| `podcast:remoteItem` | Cross-reference tracks from other feeds/artists |
| `podcast:guid` | Persistent album/track identifier across platforms |

### Wallet Switching (for Cross-Promotion)

When a podcast plays music from an S/NC Records artist:
1. The podcast uses `<podcast:valueTimeSplit>` with `<podcast:remoteItem>` pointing to the artist's music RSS feed
2. During that segment, payments redirect to the artist's value block
3. `remotePercentage` controls how much goes to the artist vs. the podcast host
4. This is "wallet switching" — payments dynamically change recipients based on what content is playing

---

## 6. Existing Platforms Using V4V for Music/Audio

### Wavlake
- **What:** Music and podcast streaming platform using Bitcoin Lightning
- **Founded by:** Michael Rhee and Sam Means
- **Model:** Artists upload tracks; listeners send boosts (sats) directly. No subscription required.
- **Fee:** 10% platform fee on boosts
- **RSS:** Every album gets a Podcasting 2.0-compliant RSS feed with value blocks
- **Distribution:** Audio accessible from any app that reads Podcasting 2.0 RSS or Nostr
- **Split support:** Artists configure wallet splits for collaborators in Wavlake Studio
- **URL:** https://wavlake.com
- **Docs:** https://docs.wavlake.com

### Fountain
- **What:** Podcast and music player app (iOS + Android)
- **Model:** Listeners stream sats per minute or send boosts with messages (boostagrams)
- **Features:** Searchable transcripts, interactive chapters, live streaming, cross-app comments, value splits
- **V4V implementation:** Reads `<podcast:value>` from RSS feeds, distributes payments per split configuration
- **URL:** https://fountain.fm

### RSS Blue
- **What:** Podcast/music hosting service focused on Podcasting 2.0
- **Music support:** Publish albums/singles with full value blocks, up to 25 split recipients
- **Wallet switching:** When tracks are played on external shows, payments redirect to artists
- **Self-hosting:** Supports hosting RSS feed on your own domain while serving media from RSS Blue CDN
- **Pricing:** $5/month base + $0.50/track or $1.50/episode
- **URL:** https://rssblue.com

### Resonate
- **What:** Multi-stakeholder cooperative music streaming service
- **Model:** "Stream2Own" — listeners pay incrementally (9 plays = ownership), not V4V/Lightning
- **Structure:** Artist-members, listener-members, worker-members (similar to S/NC's model)
- **Tech:** Open source, React Native mobile app
- **Relevance:** Organizational model precedent, but different payment technology
- **URL:** https://resonate.coop

### Other Notable Apps Supporting V4V

| App | Type | Platform |
|-----|------|----------|
| Podverse | Podcast player | iOS, Android, Web |
| Castamatic | Podcast player | iOS |
| CurioCaster | Podcast player | Web |
| Podfriend | Podcast player | Web |
| Breez | Lightning wallet with podcast player | iOS, Android |

### Payment Infrastructure

| Service | Role |
|---------|------|
| **Alby** | Lightning wallet + browser extension + NWC hub. Key V4V enabler. |
| **Alby Hub** | Self-custodial Lightning node for receiving V4V payments |
| **Nostr Wallet Connect (NWC)** | Open protocol connecting Lightning wallets to apps (NIP-47) |
| **Podcast Index** | Open podcast directory + API, central to Podcasting 2.0 ecosystem |
| **Podping** | Decentralized feed update notifications |

---

## 7. Relevance to S/NC Platform Architecture

### High-Alignment Features

1. **Automatic cooperative revenue splits** — The value/valueRecipient system is purpose-built for splitting payments among multiple contributors. S/NC can encode its cooperative structure directly into RSS feeds.

2. **Per-content customization** — Item-level value blocks and valueTimeSplit enable granular, per-episode and per-segment payment routing. A podcast episode featuring an S/NC Records artist can automatically route payments to that artist during their segment.

3. **Music as a first-class citizen** — `podcast:medium="music"` means S/NC Records can distribute music via the same RSS infrastructure as podcasts, with identical payment mechanisms.

4. **Open protocol, no platform lock-in** — The namespace is CC0, RSS is open, Lightning is permissionless. S/NC's content is discoverable across any compatible app (Fountain, Podverse, etc.) without depending on any single platform.

5. **Credits and attribution** — `<podcast:person>` with roles directly supports cooperative attribution (artist, producer, engineer, etc.).

6. **DRM-free distribution** — Aligns with S/NC's charter commitment against proprietary DRM. RSS feeds serve direct media URLs.

### Implementation Considerations

| Concern | Notes |
|---------|-------|
| **Lightning wallet management** | Each member needs a Lightning wallet/node. Alby Hub or similar can simplify this. |
| **Bitcoin volatility** | V4V payments are in sats. Members may want auto-conversion to fiat. Strike, Alby, or similar services can facilitate this. |
| **Adoption curve** | V4V is still niche. S/NC should support V4V alongside traditional payment methods (Stripe, etc.). |
| **RSS feed generation** | The platform (Hono API) should dynamically generate RSS feeds with value blocks derived from the contributor database. |
| **Feed hosting** | Self-host feeds or use RSS Blue for managed hosting with V4V built in. |
| **Podcast Index registration** | Register all feeds with the Podcast Index API for discoverability. |
| **Nostr integration** | Wavlake publishes to both RSS and Nostr. S/NC could do the same for broader reach. |

### Suggested Platform Architecture

```
S/NC Platform (Hono API + TanStack Start)
├── Content Management
│   ├── Episodes / Tracks / Albums
│   ├── Contributor assignments + roles
│   └── Split configurations (stored in DB)
├── RSS Feed Generator
│   ├── Podcast feeds (medium=podcast)
│   ├── Music feeds (medium=music)
│   ├── Dynamic <podcast:value> blocks from DB splits
│   ├── <podcast:valueTimeSplit> for mixed content
│   └── <podcast:person> from contributor records
├── Payment Layer
│   ├── Lightning (NWC / Alby integration) for V4V
│   ├── Traditional payments (Stripe) as fallback
│   └── Split calculation + disbursement engine
├── Feed Parser (podcast-partytime)
│   └── Ingest external feeds for aggregation / display
└── API Integration
    ├── Podcast Index API (registration + discovery)
    └── Podping (feed update notifications)
```

---

## Sources

- [Podcast Namespace GitHub Repository](https://github.com/Podcastindex-org/podcast-namespace)
- [Podcasting 2.0 Documentation](https://podcasting2.org/docs/podcast-namespace)
- [Podcast Namespace Tag Specification 1.0](https://podcasting2.org/docs/podcast-namespace/1.0)
- [Value Tag Specification](https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/value.md)
- [ValueTimeSplit Specification](https://podcasting2.org/docs/podcast-namespace/tags/value-time-split)
- [ValueRecipient Documentation](https://podcasting2.org/podcast-namespace/tags/valueRecipient)
- [Example Feed XML](https://github.com/Podcastindex-org/podcast-namespace/blob/main/example.xml)
- [Podcast Index API Documentation](https://podcastindex-org.github.io/docs-api/)
- [podcast-partytime (npm)](https://www.npmjs.com/package/podcast-partytime)
- [podcast-partytime Source (GitHub)](https://github.com/RyanHirsch/partytime)
- [Wavlake — V4V Music Platform](https://wavlake.com/)
- [Wavlake Documentation](https://docs.wavlake.com/)
- [Wavlake: Value for Value Music with Lightning](https://zine.wavlake.com/value-for-value-music-with-lightning-what-a-concept/)
- [Fountain Podcasts](https://www.fountain.fm/)
- [What is Podcasting 2.0? (Fountain)](https://support.fountain.fm/article/91-what-is-podcasting-2-0)
- [RSS Blue](https://rssblue.com/)
- [RSS Blue: Guide to V4V Music](https://rssblue.com/help/music-podcasts)
- [RSS Blue: Value-for-Value](https://rssblue.com/help/v4v)
- [Resonate Co-op](https://resonate.coop/)
- [Alby — Bitcoin Lightning Payments](https://blog.getalby.com/bitcoin-payments-for-podcasters-with-alby/)
- [How to Prepare Your RSS Feed for V4V (Alby)](https://blog.getalby.com/how-to-prepare-your-rss-feed-to-receive-value4value-payments/)
- [Value Time Split — Alby Blog](https://blog.getalby.com/value-time-split-the-latest-innovation-in-podcasting-2-0/)
- [NWC JS SDK — Alby Developer Guide](https://guides.getalby.com/developer-guide/developer-guide/nostr-wallet-connect-api/building-lightning-apps/nwc-js-sdk)
- [Nostr Wallet Connect](https://nwc.dev/)
- [Value Time Split — Blubrry](https://blubrry.com/support/podcasting-2-0-introduction/value-time-split/)
- [Podcast Mirror — Podcasting 2.0 Overview](https://www.podcastmirror.com/podcasting-2-0/)
- [podcast-index-api (npm)](https://www.npmjs.com/package/podcast-index-api)
- [podcast npm package](https://www.npmjs.com/package/podcast)

*Last updated: 2026-03-05*
