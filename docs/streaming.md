# Streaming

S/NC TV is an always-on broadcast channel. It plays something 24/7 — right now that's a rotation of classic films. When a creator goes live, their stream takes over the channel automatically. When they end, the channel falls back to the rotation. Viewers watch at `/live`. The channel can also be simulcast to external platforms like Twitch and YouTube.

## How It Works

Three layers, each with one job:

```
┌─────────────────────┐     ┌──────────────┐     ┌─────────────────────────┐
│   What plays         │     │  Streaming   │     │  Where it goes          │
│                      │     │   server     │     │                         │
│   Liquidsoap         │────▶│   SRS        │────▶│  /live (HLS)            │
│   playout engine     │     │              │     │  Twitch (RTMP)          │
│                      │     │              │     │  YouTube (RTMP)         │
└─────────────────────┘     └──────────────┘     └─────────────────────────┘
```

**Liquidsoap** decides what plays. Each channel's airing priority is its **editorial config** — an ordered set of source tiers the engine renders into a readiness fallback. S/NC TV's config is: live creator (highest priority) → its own queue → a carried playout channel (S/NC Classics) → silence. The highest-priority *ready* source wins, so a live creator preempts automatically and falls back when they stop. Its output is a single continuous RTMP stream that it pushes to SRS.

**SRS** (Simple Realtime Server) is the streaming server. It receives Liquidsoap's output, serves HLS to viewers on `/live`, and forwards the stream to any configured simulcast destinations (Twitch, YouTube, etc.). It also receives incoming creator streams and routes them to Liquidsoap for the live takeover.

**The platform API** connects them. SRS calls back to the API when a stream starts, ends, or needs forwarding. The API validates stream keys, tracks sessions, manages channels, and tells SRS where to send things.

Liquidsoap doesn't know about Twitch. SRS doesn't know about playlists. The API doesn't re-encode video.

## Channels

Three types of channels:

**S/NC TV** is the main broadcast channel. It's always on. Whatever Liquidsoap outputs — classics rotation, a live creator, a queued item — is what S/NC TV shows. This is the channel that gets simulcast to external platforms. S/NC TV is an ordinary editorial-config channel (role `broadcast`): its live takeover is the priority-0 tier of its config, not a Liquidsoap special case. Its config carries the S/NC Classics channel as a `channel-as-source` fallback tier.

**Playout channels** (like S/NC Classics) are content sources. Each has its own playlist and admin queue. S/NC TV carries the Classics channel as a fallback tier in its editorial config. Future themed channels (Horror, Retro, etc.) will be additional playout channels that an admin can switch between or carry.

**Creator channels** are persistent. Each creator has one durable `ownership='creator'` / `role='live-ingest'` channel, lazy-provisioned by `ensureCreatorChannel` on first stream-key creation and surviving publish/unpublish cycles. It is the creator's editorial surface: even offline, a creator with `manageStreaming` drives its queue and content pool from the Programming tab on creator manage (see [creators.md](creators.md)). Going live flips `isActive`, not the channel's existence; ending the stream flips it back. While active, the creator's stream takes over S/NC TV automatically — it arrives on the broadcast live input, which is the highest-priority tier of S/NC TV's editorial config.

## Stream Flow

### Always-on playout

Liquidsoap runs continuously in a Docker container. It reads a playlist file (M3U), fetches media from S3 (Garage), and re-encodes to FLV/RTMP. Its output pushes to SRS under the `snc-tv` stream name.

SRS serves this as HLS at `/live`. Viewers connect, see whatever's playing. No interaction needed from anyone — it just runs.

### Creator goes live

1. A creator points OBS at `rtmp://<server>/live/<stream-name>?key=<stream-key>`
2. SRS receives the stream and fires `on_publish` → the API validates the stream key (SHA256 hash lookup), opens a session, and creates a live channel
3. SRS fires `on_forward` → the API returns Liquidsoap's RTMP input URL
4. SRS forwards the creator's stream to Liquidsoap
5. Liquidsoap detects the live input and switches from the playlist to the creator's feed
6. S/NC TV now carries the creator's stream — including on any simulcast destinations

### Creator ends stream

1. SRS fires `on_unpublish` → the API closes the session and deactivates the live channel
2. Liquidsoap detects the live input has stopped and falls back to the admin queue or playlist
3. S/NC TV returns to the classics rotation

### Simulcast

SRS can forward any stream to additional RTMP destinations. For the S/NC TV playout stream, the `on_forward` callback queries the `simulcast_destinations` table and returns active RTMP URLs. SRS pushes the stream to each one.

Simulcast sits on the playout output, not on individual creator streams. Whatever S/NC TV is showing is what Twitch and YouTube get. Creator takes over? They get the creator. Creator ends? Back to classics. No switching logic needed.

Destinations are managed by admins at `/admin/simulcast`. Adding or removing a destination while the stream is live triggers an SRS config reload so changes take effect immediately without restarting the stream.

## Playout Administration

Admins manage playout content at `/admin/playout`. Two concepts:

**The playlist** is the background rotation — a curated, ordered list of media items. Admins toggle items on/off, reorder them, and save as a batch. The playlist auto-plays when nothing else is queued. Changes are written to the M3U file and Liquidsoap reloads it.

**The queue** is for live control — "play this next." Queued items take priority over the playlist. They're ephemeral and managed through Liquidsoap's request queue. When the queue empties, playback falls back to the playlist.

In Liquidsoap these are separate sources in the fallback chain:

```
live creator > admin queue > playlist > silence
```

Admins can also skip the current track, which advances to the next queued item or playlist track.

### Creator editorial surface

The queue + content-pool + control surface admins use at `/admin/playout` is the **same surface** creators use for their own channel, at the Programming tab on creator manage. There is one editorial surface (`<EditorialSurface>`), mounted at two points, and one backend logic path behind two gates:

- **Admin mount** keeps the full surface: all-channel tabs, channel create/delete, broadcast banner, engine-restart. Gated by `requireRole("admin")` on the `/api/playout/*` routes.
- **Creator mount** is the surface minus those admin-only capabilities — queue, content pool (auto-scoped to the creator's own content), and manual/auto control for the creator's single persistent channel. Gated by `requireCreatorChannelPermission("manageStreaming")` on the `/api/creator/playout/*` routes, which loads the channel, asserts it is the creator's own `live-ingest` channel, and delegates to the per-creator permission check (owner-only; see [creators.md](creators.md)).

Cross-tenant isolation lives in the orchestrator: the content scope is derived from the channel's ownership row, never from caller input, so a creator can only search, assign, or queue their own non-deleted content. Creator editorial changes ride the `content` SSE topic scoped to the owning creator (admin changes ride the `playout` topic, unchanged).

Creator channels do **not** carry other channels (no `channel-as-source` tier) — cross-creator "hosting" is a viewer-layer presentation re-point, not media-layer carry, and is deferred to the live-experience work.

### Liquidsoap configuration

The playout engine runs from `liquidsoap/playout.liq` inside a Docker container. The `.liq` is **generated from the database** — every active channel (playout + the S/NC TV broadcast) emits a channel block from its editorial config; there is no hand-maintained per-channel section. S/NC TV and S/NC Classics are two of those generated channels.

**S/NC Classics** (the content source):

```
classics queue (+ pool auto-fill) > silence
```

The queue is a `request.queue` that accepts items pushed via Harbor HTTP; when empty it auto-fills from the channel's content pool (least-recently-played rotation).

**S/NC TV** (the broadcast channel):

```
live creator > snc-tv queue > S/NC Classics (carried) > silence
```

This is S/NC TV's editorial config rendered as a fallback chain. Live creator input comes via RTMP on port 1936 (the broadcast live tier) — when a creator stream arrives it takes over automatically as the highest-priority ready source. The S/NC TV queue lets admins push items directly to the broadcast channel. When nothing is live or queued, it carries whatever S/NC Classics is playing (a `channel-as-source` tier). A small telemetry hook posts each source switch to the API so the live-state view stays current.

Both channels encode to H.264/AAC (2500k video, 128k audio, ultrafast preset) and push RTMP to SRS. The playout stream key (`PLAYOUT_STREAM_KEY` env var) authenticates the connection.

**Metadata propagation.** Playlist entries use Liquidsoap's `annotate:` prefix to carry metadata through the pipeline — `s3_uri` and `title` survive source transitions so the API can report what's currently playing.

### Harbor HTTP API

Liquidsoap exposes an HTTP control API on port 8888 for admin operations. The platform API calls these endpoints through the `liquidsoap.ts` service wrapper.

| Method | Path | What it does |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/now-playing` | S/NC TV current track metadata |
| POST | `/skip` | Skip current track on S/NC TV |
| POST | `/queue` | Queue URI on S/NC TV (body: annotated URI) |
| GET | `/classics/now-playing` | S/NC Classics current track metadata |
| POST | `/classics/skip` | Skip current track on S/NC Classics |
| POST | `/classics/queue` | Queue URI on S/NC Classics (body: annotated URI) |
| POST | `/reload-playlist` | Reload playlist from disk |

The API wrapper (`services/liquidsoap.ts`) adds a 3-second timeout to all Harbor calls and degrades gracefully — if Liquidsoap is unreachable, status endpoints return null rather than erroring. This lets the admin UI function even when Liquidsoap is restarting.

### Playlist regeneration

The playlist is an M3U file that Liquidsoap reads. The API owns the file — it regenerates it from the database whenever the playlist changes, then tells Liquidsoap to reload.

**The cycle:**

1. Admin saves playlist changes (reorder, toggle items, delete) or the ingest job marks a new item "ready"
2. `regeneratePlaylist()` queries enabled items with `processingStatus = "ready"`, ordered by position
3. Builds the M3U — each entry has an `#EXTINF` line (duration, title) and an `annotate:s3_uri="...":s3://...` URI
4. Writes to a temp file, then atomic-renames to `liquidsoap/playlist.m3u` (prevents partial reads)
5. Calls `POST /reload-playlist` on Harbor — best-effort, since the file write already succeeded

**Rendition selection.** Each item can have multiple renditions (1080p, 720p, 480p) plus the original source. Playlist generation picks the best available: 1080p → 720p → 480p → source. This happens at M3U generation time, not at playback time.

**When it triggers:** Any operation that changes what should be playing — `savePlaylist()`, `reorderPlayoutItems()`, `deletePlayoutItem()`, and the ingest job completing successfully.

### Skip and queue operations

Skip and queue go through the platform API, which proxies to Liquidsoap's Harbor endpoints.

**Skip** (`POST /api/playout/skip`) calls Harbor's `/classics/skip`. The current track stops and playback advances to the next queued item, or the next playlist track if the queue is empty.

**Queue** (`POST /api/playout/queue/:id`) looks up the playout item in the database, selects the best rendition URI, wraps it with `annotate:s3_uri="..."` metadata, and posts it to Harbor's `/classics/queue`. The API also tracks queued items in memory so the status endpoint can report what's coming up.

**Status polling** (`GET /api/playout/status`) fetches now-playing from Harbor and combines it with the in-memory queue. Queue entries are pruned as they start playing. This is the endpoint the admin UI polls for live updates.

The in-memory queue is ephemeral — it's lost on API restart. This is fine because Liquidsoap's own request queue is the source of truth for playback. The API's copy is just for display.

### Playout ingest

Uploaded media goes through an ingest pipeline before it can play:

1. Admin uploads media at `/admin/playout` — file goes to S3 under `playout/{id}/source/`
2. Upload route queues a `playout/ingest` background job (pg-boss)
3. Job downloads the source from S3 to a temp file
4. Remux with FFmpeg (codec copy) to strip non-AV streams — timecodes, chapter markers, and camera telemetry that can hang Liquidsoap's decoder
5. Upload the clean file back to S3, probe for duration/resolution
6. Mark the item as "ready" and trigger `regeneratePlaylist()`

If any step fails, the item is marked "failed" with the error message. The admin can re-upload to try again.

## Infrastructure

### Services

| Service | Role | Port(s) |
|---------|------|---------|
| **SRS** | RTMP ingest, HLS output, stream forwarding | 1935 (RTMP), 8080 (HTTP/HLS), 1985 (API) |
| **Liquidsoap** | Playout engine, fallback chain, re-encoding | 1936 (RTMP input), 8888 (Harbor HTTP) |
| **Platform API** | Stream key validation, session tracking, callbacks, admin endpoints | 3000 |

### SRS Callbacks

SRS calls back to the platform API on three events:

| Callback | Trigger | What the API does |
|----------|---------|-------------------|
| `on_publish` | Stream starts | Validates stream key, opens session, creates live channel |
| `on_unpublish` | Stream ends | Closes session, deactivates live channel |
| `on_forward` | Stream needs forwarding | Returns RTMP destination URLs (Liquidsoap for creator streams, simulcast destinations for playout) |

### Stream Keys

Creators generate stream keys from their manage page. The raw key is shown once at creation and never stored. The database keeps a SHA256 hash and a short prefix for identification. When a stream connects, `on_publish` hashes the incoming key and looks up the match.

Playout uses a separate dedicated key (`PLAYOUT_STREAM_KEY` env var) that Liquidsoap includes when pushing to SRS.

### Feature Flag

Streaming is gated behind the `FEATURE_STREAMING` flag. When disabled, streaming API routes are not mounted and the `/live` page redirects away. See [feature-flags.md](feature-flags.md).
