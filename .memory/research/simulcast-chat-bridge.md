---
updated: 2026-04-16
---

# Simulcast Chat Bridge

**Status:** Draft
**Date:** 2026-04-04

Technical research on building a chat bridge that relays messages between Twitch, YouTube Live, and S/NC's custom WebSocket-based chat system. The goal is unified chat during simulcast streams: viewers on any platform see messages from all platforms (or at minimum, external messages appear in S/NC chat).

This research supports the simulcast architecture established in `streaming-infrastructure.md` (SRS-based multi-destination broadcasting) and the platform's broader goal of being the primary viewing experience for S/NC creators.

---

## 1. Twitch Chat API

### Connection Methods

Twitch offers two paths. The legacy IRC interface still works but Twitch is actively pushing developers toward EventSub.

**IRC (Legacy, Still Supported)**

- WebSocket endpoint: `wss://irc-ws.chat.twitch.tv:443`
- TCP endpoint: `irc.chat.twitch.tv:6667` (plaintext) or `:6697` (TLS)
- Protocol: Modified RFC 1459 + IRCv3 Message Tags
- After connecting, authenticate with `PASS oauth:<token>` and `NICK <username>`, then `JOIN #<channel>`
- Must respond to `PING` with `PONG` to maintain connection
- Chat messages arrive as `PRIVMSG` commands
- Request capabilities with `CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership` to get metadata

**EventSub WebSocket (Recommended)**

- WebSocket endpoint: `wss://eventsub.wss.twitch.tv/ws`
- First message is a welcome containing a `session_id`, used when subscribing to events
- Subscribe to `channel.chat.message` (v1) for chat messages
- Subscribe to `channel.chat.notification` for system messages (subs, raids, etc.)
- More structured JSON payloads than raw IRC
- Twitch's recommended path for new development

### Authentication

- Requires a registered Twitch application (Client ID + Client Secret)
- User Access Token with OAuth scopes:
  - `chat:read` / `chat:edit` (IRC)
  - `user:read:chat` / `user:write:chat` (EventSub/Helix)
  - `user:bot` (App Access Token sending), `channel:bot` (broadcaster permission)
- Bot accounts: dedicated Twitch account, register app, OAuth Authorization Code flow
- Tokens expire; must implement refresh token flow

### Rate Limits

**Reading:** No explicit rate limit on receiving messages.

**Sending (IRC):**
- Regular accounts: **20 messages per 30 seconds**
- Moderator in channel: **100 messages per 30 seconds**
- Verified bot: **50 messages per 30 seconds** (rarely granted)

**Sending (Helix API):** 800 requests/minute for user tokens.

### Message Metadata

IRC tags include: `display-name`, `user-id`, `badges` (e.g., `subscriber/12,moderator/1`), `emotes` (IDs + character positions), `color` (hex), `room-id`, `id` (unique message ID), `tmi-sent-ts` (timestamp). EventSub provides equivalent data in structured JSON.

### Terms of Service — Critical Finding

Twitch's simulcasting guidelines explicitly state:
> "You do not use third-party services that combine activity from other platforms or services on your Twitch stream during your Simulcast, such as merging chat or other features."

**Implications:**
- **Inbound to S/NC is fine.** Pulling Twitch messages into S/NC chat is permitted.
- **Displaying merged chat ON the Twitch stream is prohibited.**
- **Outbound from S/NC to Twitch via bot is likely acceptable** (bot posting messages, not merging external chat into Twitch experience), but excessive bot messages could trigger spam detection.
- You may not direct Twitch viewers to leave Twitch for other platforms.

### Node.js Libraries

**Twurple** (`@twurple/*`) is the clear winner: TypeScript-first, covers IRC + EventSub + Helix API + auth token refresh. Updated Feb 2026. Packages: `@twurple/auth`, `@twurple/api`, `@twurple/chat`, `@twurple/eventsub-ws`.

**tmi.js** is the classic IRC-only library, still maintained but no EventSub support. ~5,400 weekly npm downloads.

---

## 2. YouTube Live Chat API

### How It Works

YouTube Live Chat uses the YouTube Data API v3. Chat is accessed through the `liveChatMessages` resource. The primary access pattern is polling, though a newer gRPC streaming method exists.

**Workflow:** Get `liveChatId` from broadcast → poll `liveChatMessages.list` or connect via `liveChatMessages.streamList` → use `nextPageToken` + respect `pollingIntervalMillis`.

### Authentication

- Google Cloud project with YouTube Data API v3 enabled
- Reading public chat: API key may suffice
- Sending messages: OAuth 2.0 required (scope: `youtube` or `youtube.force-ssl`)
- If app is "external," OAuth consent screen needs Google verification (can take weeks)
- Sending requires channel owner or moderator auth

### Polling vs. Real-Time

**`liveChatMessages.list` (Polling):** Standard REST, `pollingIntervalMillis` typically 5,000-10,000ms. Latency: 5-15 seconds.

**`liveChatMessages.streamList` (Server Streaming):** Newer gRPC streaming method. Long-lived connection, server pushes messages as they arrive. Lower latency (2-5s estimated). Supports resume via `nextPageToken`. Less documented, fewer community examples.

### Rate Limits and Quota — The Hard Constraint

- Default quota: **10,000 units per day** per project
- `liveChatMessages.list`: **5 units per request**
- At one poll every 6 seconds: ~7,200 units for an 8-hour stream (just reading)
- `liveChatMessages.insert` (sending): **200 units per request**
- **Sending 50 messages exhausts the entire daily quota**
- Quota increase requires application to Google, not guaranteed, takes weeks

This is the single biggest constraint for the YouTube side of the bridge.

### Message Metadata

Each message includes: `authorDetails.channelId`, `displayName`, `profileImageUrl`, role flags (`isChatOwner`, `isChatModerator`, `isChatSponsor`), `snippet.type` (text, Super Chat, Super Sticker, membership milestone), `snippet.displayMessage`, `snippet.publishedAt`. Super Chat includes `amountMicros`, `currency`, `tier`.

### ToS Implications

YouTube API ToS requires YouTube branding when showing YouTube data. Must attribute messages to YouTube source. Does not explicitly prohibit bridging, but commercial use requires compliance review. Rate limit abuse can result in project suspension.

### Node.js Libraries

**`googleapis`** (official): typed access to all Google APIs, handles OAuth and pagination. Verbose but reliable.

**Masterchat** (`github.com/HolodexNet/masterchat`): Unofficial library scraping YouTube's internal chat API. Does NOT consume API quota. Supports 20+ action types. Risk: reverse-engineered, can break when YouTube changes frontend. Used by Holodex (major VTuber tracker).

---

## 3. Architecture Patterns

### Proposed Architecture

```
                +-------------------+
                |   S/NC WebSocket  |
                |   Chat Server     |
                +--------+----------+
                         |
                +--------+----------+
                |   Message Router  |
                |   (Event Bus)     |
                +--------+----------+
                    |         |
           +-------+--+  +--+-------+
           |  Twitch   |  | YouTube  |
           |  Adapter  |  | Adapter  |
           +-------+--+  +--+-------+
                   |         |
              EventSub    YouTube API
              WebSocket   (poll/stream)
```

**Message bus options:** In-process EventEmitter (simplest), Redis Pub/Sub (distributed), or PostgreSQL LISTEN/NOTIFY (already in stack).

**Common message format:** Normalized `BridgedMessage` with `source`, `author` (platformId, displayName, avatarUrl, roles), `content`, `emotes`, `timestamp`, and platform-specific `metadata`.

### Inbound-Only vs. Bidirectional

**Inbound-only (recommended MVP):** External messages flow into S/NC. No ToS risk, no rate limit concerns for sending. S/NC becomes the unified view.

**Bidirectional:** YouTube outbound is infeasible (200 units/message = ~50 messages/day). Twitch outbound is possible but rate-limited (20/30s). All outbound messages come from a bot account — identity is lost.

### Identity Mapping

Three progressive options: (A) Prefix model (`[TW]`/`[YT]` badges) for MVP, (B) Ghost users (Matrix-style, overkill for MVP), (C) Linked accounts via OAuth (best UX, Phase 3).

### Latency

| Source | Method | Expected Latency |
|--------|--------|-----------------|
| Twitch IRC | WebSocket | <1 second |
| Twitch EventSub | WebSocket | 1-3 seconds |
| YouTube `list` | Polling | 5-15 seconds |
| YouTube `streamList` | gRPC streaming | 2-5 seconds (est.) |
| S/NC native | WebSocket | <200ms |

YouTube latency is inherent to the API. With HLS video latency at 10-30s, chat latency of 5-15s is within the same ballpark.

---

## 4. Existing Solutions

### Open Source

- **Matterbridge** — Go, 7k+ stars, 25+ platforms including Twitch. No YouTube support. Best architecture reference.
- **AxelChat** — Desktop aggregator, Twitch + YouTube + more, read-only, OBS widgets.
- **Social Stream Ninja** — Free browser-based aggregation, many platforms, read-only.
- **Masterchat** — Best Node.js library for YouTube chat (unofficial, scrapes internal API).

### SaaS

- **Restream Chat** — Most widely used, bidirectional relay, 30+ platforms, proprietary.
- **Streamlabs** — Display-only chat widget.
- **StreamUps** — Merged overlay, display-only.

### What Streamers Actually Use

Read-only aggregation is the norm. True bidirectional bridging is rare outside Restream. Most streamers use Social Stream Ninja, AxelChat, or just multiple browser tabs.

---

## 5. Feasibility Assessment

### What's Easy
- **Twitch inbound relay:** Well-documented, real-time WebSocket, excellent libraries (Twurple). 1-2 days.
- **S/NC chat server integration:** Full control, Hono WebSocket, design for bridging from day one. 2-3 days.
- **Message routing:** Well-understood event bus pattern. 1 day.

### What's Medium
- **YouTube inbound:** Polling adds latency, quota is tight but workable for reading, OAuth setup is bureaucratic. 2-3 days + setup time.
- **Twitch outbound:** Rate-limited but feasible, identity is bot-based. 1-2 days.

### What's Hard
- **YouTube outbound:** 200 units/message makes this infeasible. Do not attempt.
- **Bidirectional identity:** All outbound is bot-posted; no way around it without platform cooperation.
- **Cross-platform emote rendering:** Possible for Twitch (CDN URLs), impractical to translate between platforms.

### What's Risky
- **Twitch ToS on merged chat display:** Bridge itself is fine, but merged chat must never appear on the Twitch stream. Creator education required.
- **Masterchat (unofficial YouTube API):** Bypasses quota but can break without notice. Use as fallback only.
- **YouTube quota exhaustion:** 10,000 units/day is tight for long streams. Implement quota tracking and graceful degradation.
- **Google OAuth verification:** Budget 2-4 weeks if the app is public.

---

## 6. Recommended MVP

### Phase 1: Inbound-Only (2-3 weeks)
Twitch and YouTube messages flow into S/NC chat. S/NC is the unified view. Use `@twurple/eventsub-ws` for Twitch (real-time), `googleapis` for YouTube (polling). Prefix-based identity (`[TW]`/`[YT]` badges).

### Phase 2: Selective Twitch Outbound (1-2 weeks)
S/NC messages relayed to Twitch via bot. Rate-limited, configurable per-stream. Skip YouTube outbound entirely.

### Phase 3: Linked Accounts (future)
OAuth linking for Twitch/YouTube accounts. Recognized S/NC identity across platforms. Cross-platform moderation.

### Tech Stack

| Component | Technology |
|-----------|-----------|
| Chat server | Hono WebSocket (existing) |
| Twitch adapter | `@twurple/eventsub-ws` + `@twurple/api` |
| YouTube adapter | `googleapis` (official API) |
| Message bus | Node.js EventEmitter or Redis Pub/Sub |
| Message store | PostgreSQL (existing) |
| Frontend | React in TanStack Start (existing) |
