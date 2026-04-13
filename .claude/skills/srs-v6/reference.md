# SRS v6 API Reference

## HTTP API

**Base URL:** `http://host:1985`
**Auth:** Optional basic auth (v6.0.40+): `http://user:pass@host:1985/...`

### Core Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/versions` | Server version info (good for health checks) |
| GET | `/api/v1/summaries` | System summaries (memory, CPU, network, load) |
| GET | `/api/v1/streams` | List active streams |
| GET | `/api/v1/streams/{id}` | Get specific stream |
| GET | `/api/v1/clients` | List connected clients |
| GET | `/api/v1/clients/{id}` | Get specific client |
| DELETE | `/api/v1/clients/{id}` | Kick (disconnect) a client |
| GET | `/api/v1/vhosts` | List virtual hosts |
| GET | `/api/v1/vhosts/{id}` | Get specific vhost |

### Stream Listing

```
GET /api/v1/streams?start=0&count=100
```

**Query Parameters:**
- `start` — offset (default: 0)
- `count` — max results (default: 10)

**Response:**
```json
{
  "code": 0,
  "server": "vid-...",
  "streams": [
    {
      "id": "vid-...",
      "name": "livestream",
      "vhost": "vid-...",
      "app": "live",
      "live_ms": 1620000000000,
      "clients": 5,
      "frames": 12345,
      "send_bytes": 67890,
      "recv_bytes": 12345,
      "kbps": { "recv_30s": 2500, "send_30s": 12500 },
      "publish": {
        "active": true,
        "cid": "vid-..."
      },
      "video": { "codec": "H264", "profile": "High", "level": "3.1", "width": 1920, "height": 1080 },
      "audio": { "codec": "AAC", "sample_rate": 44100, "channel": 2, "profile": "LC" }
    }
  ]
}
```

### Management Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/authors` | License and author info |
| GET | `/api/v1/features` | Supported features list |
| GET | `/api/v1/requests` | HTTP request debug info |
| GET | `/api/v1/rusages` | Resource usage (CPU, memory) |
| GET | `/api/v1/meminfos` | System memory info |

### WebRTC (WHIP/WHEP)

**WHIP — Publish via WebRTC:**
```
POST /rtc/v1/whip/?app=live&stream=livestream
Content-Type: application/sdp
Body: <SDP offer>

Response: 201 Created
Content-Type: application/sdp
Body: <SDP answer>
```

**WHEP — Play via WebRTC:**
```
POST /rtc/v1/whep/?app=live&stream=livestream
Content-Type: application/sdp
Body: <SDP offer>

Response: 201 Created
Content-Type: application/sdp
Body: <SDP answer>
```

### Raw API (Management Operations)

Requires config:
```
raw_api {
    enabled on;
    allow_reload on;
}
```

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/raw?rpc=raw` | Query raw API config |
| GET | `/api/v1/raw?rpc=reload` | Reload SRS config (like `kill -1`) |

### Raw API (Config Reload)

Requires explicit config:
```
http_api {
    enabled on;
    listen 1985;
    raw_api {
        enabled on;
        allow_reload on;
    }
}
```

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/raw?rpc=raw` | Query raw API status/config |
| GET | `/api/v1/raw?rpc=reload` | Reload SRS config (same as `kill -1 srs`) |

**Reload example:**
```
GET http://127.0.0.1:1985/api/v1/raw?rpc=reload
```

Returns `{"code": 0}` on success. Without `raw_api` enabled, SRS returns error code 1061.

**Note:** Other raw API operations (config persistence, dynamic vhost management) were disabled in SRS 4.0+. Only `raw` query and `reload` remain.

### Response Format

All API responses include a `code` field:
- `0` — success
- Non-zero — error (check HTTP status code too)

```json
{ "code": 0, "server": "vid-...", "data": { ... } }
```

### Performance

HTTP API supports approximately 370 requests per second. Use callbacks for real-time events rather than polling.

---

## Forward (RTMP Relay to Other Servers)

Forwards published streams from this SRS instance to other RTMP servers. Two modes: static destinations (config-defined) and dynamic backend (HTTP API-driven).

**Use case:** Simulcast to external platforms (Twitch, YouTube) or fault-tolerance replication to other SRS instances.

**Not for CDN.** Forward copies all streams to all destinations. For large-scale distribution, use Edge mode instead.

### Static Forward

Forwards all published streams to fixed `ip:port` destinations. The same `app/stream` path is used at the destination.

```
vhost __defaultVhost__ {
    forward {
        enabled on;
        destination 127.0.0.1:1936 127.0.0.1:1937;
    }
}
```

- `destination` accepts space-separated `{ip}:{port}` pairs
- **Static destinations only support `ip:port`** — cannot specify app/stream path. The original app and stream name are preserved at the destination
- All published streams on this vhost are forwarded (no per-stream filtering)

### Dynamic Forward (HTTP Backend)

Queries an HTTP backend per-publish to determine where to forward. Supports **full RTMP URLs** including custom app/stream paths — required for external platforms like Twitch/YouTube.

```
vhost __defaultVhost__ {
    forward {
        enabled on;
        backend http://127.0.0.1:8085/api/v1/forward;
    }
}
```

**Request:** SRS sends a POST when a client publishes:
```json
{
    "action": "on_forward",
    "server_id": "vid-k21d7y2",
    "client_id": "9o7g1330",
    "ip": "127.0.0.1",
    "vhost": "__defaultVhost__",
    "app": "live",
    "tcUrl": "rtmp://127.0.0.1:1935/live",
    "stream": "livestream",
    "param": "?key=secret123"
}
```

**Response:** Return HTTP 200 with RTMP destination URLs:
```json
{
    "code": 0,
    "data": {
        "urls": [
            "rtmp://live.twitch.tv/app/tw_streamkey123",
            "rtmp://a.rtmp.youtube.com/live2/yt_streamkey456"
        ]
    }
}
```

- URLs are **full RTMP paths** — can include any app and stream key
- Return an **empty array** `[]` to disable forwarding for this stream
- Return `{"code": 1}` to reject forwarding (does not reject the publish itself — that's handled by `on_publish`)
- Called **once per publish** — not per-frame or per-segment

### Forward + Callbacks Interaction

Forward backend (`on_forward`) and auth callback (`on_publish`) are **separate hooks**:
1. `on_publish` fires first — authenticates the publisher (return non-zero to reject)
2. `on_forward` fires after — determines forward destinations (return empty URLs to skip forwarding)

Both can inspect the same `stream`, `app`, and `param` fields to make per-stream decisions.

### TypeScript Interface

```typescript
interface SrsForwardRequest {
    action: "on_forward"
    server_id: string
    client_id: string
    ip: string
    vhost: string
    app: string
    tcUrl: string
    stream: string
    param: string
}

interface SrsForwardResponse {
    code: number       // 0 = success
    data: {
        urls: string[] // Full RTMP URLs, empty array to skip
    }
}
```

---

## Edge Mode (CDN Distribution)

Edge servers fetch streams from an origin on-demand. Unlike forward (which pushes all streams), edge only pulls streams that viewers request — efficient for CDN distribution.

### Configuration

**Origin server** (no special config needed):
```
listen 19350;
vhost __defaultVhost__ {
}
```

**Edge server:**
```
listen 1935;
vhost __defaultVhost__ {
    cluster {
        mode            remote;
        origin          127.0.0.1:19350;
    }
}
```

### Key Parameters

| Parameter | Purpose |
|-----------|---------|
| `mode` | `remote` for edge, `local` for origin (default) |
| `origin` | Space-separated upstream origin `ip:port` addresses (failover order) |
| `token_traverse` | When `on`, edge forwards auth checks to origin |
| `vhost` | Which origin vhost to fetch from (defaults to current vhost) |

### Edge Behavior

- **Edge play:** When a viewer requests a stream on the edge, it fetches from origin once per stream, then serves all local viewers from that single upstream connection
- **Edge publish:** Streams published to an edge are forwarded to the origin
- **Failover:** If primary origin is unreachable, edge tries the next origin in the list
- **HLS:** Never configure HLS on edge servers — generate HLS at origin or use HTTP proxy (Squid, Nginx)

---

## SRT Ingest

SRT (Secure Reliable Transport) provides low-latency UDP-based ingest. SRS converts SRT to RTMP internally.

### Configuration

```
srt_server {
    enabled on;
    listen 10080;
}

vhost __defaultVhost__ {
    srt {
        enabled on;
        srt_to_rtmp on;
    }
}
```

### Key Parameters

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `listen` | 10080 | UDP port for SRT connections |
| `connect_timeout` | 4000 | Connection timeout (ms) |
| `peer_idle_timeout` | 8000 | Idle disconnect timeout (ms) |
| `latency` | — | Unified send/receive latency (ms) |
| `recvlatency` | — | Receive buffer latency (ms) |
| `peerlatency` | — | Peer-side latency (ms) |
| `tsbpdmode` | on | Timestamp-based packet delivery |
| `tlpktdrop` | on | Drop late packets under congestion |
| `mss` | 1500 | Max segment size (bytes) |

### Stream Mapping

SRT streams map to RTMP paths via the `streamid` parameter:

```
#!::r=live/livestream,m=publish
```

Maps to RTMP path `rtmp://host/live/livestream`. The `m=publish` indicates this is a publish (vs. play) connection.

**Latency:** SRT delivers 300-500ms latency vs. RTMP's 1-3 seconds.

---

## HTTP Callbacks (Hooks)

SRS sends HTTP POST requests to configured URLs when events occur. All callbacks share a common request body schema with event-specific additions.

### Configuration

```
vhost __defaultVhost__ {
    http_hooks {
        enabled on;
        on_publish      http://api:3000/hooks/on-publish;
        on_unpublish    http://api:3000/hooks/on-unpublish;
        on_play         http://api:3000/hooks/on-play;
        on_stop         http://api:3000/hooks/on-stop;
        on_dvr          http://api:3000/hooks/on-dvr;
        on_hls          http://api:3000/hooks/on-hls;
        on_hls_notify   http://cdn:8080/hooks/[server_id]/[app]/[stream]/[ts_url][param];
    }
}
```

Multiple URLs per event are supported:
```
on_publish http://api1:3000/hook http://api2:3000/hook;
```

### Common Request Body

All POST callbacks include these fields:

```typescript
interface SrsCallback {
  server_id: string      // SRS server ID (e.g., "vid-0xk989d")
  action: string         // Event name (e.g., "on_publish")
  client_id: string      // Unique client ID (e.g., "341w361a")
  ip: string             // Client IP address
  vhost: string          // Virtual host (e.g., "__defaultVhost__")
  app: string            // Application name (e.g., "live")
  tcUrl: string          // Full RTMP URL
  stream: string         // Stream name (e.g., "livestream")
  param: string          // URL query string (e.g., "?key=secret123")
  stream_url: string     // Full stream URL
  stream_id: string      // Stream ID
}
```

### Event Types

| Event | Trigger | Method | Extra Fields |
|-------|---------|--------|-------------|
| `on_publish` | Client starts publishing | POST | — |
| `on_unpublish` | Client stops publishing | POST | — |
| `on_play` | Client starts playback | POST | `pageUrl` |
| `on_stop` | Client stops playback | POST | — |
| `on_dvr` | DVR file created | POST | `cwd`, `file` |
| `on_hls` | HLS segment created | POST | `duration`, `cwd`, `file`, `url`, `m3u8`, `m3u8_url`, `seq_no` |
| `on_hls_notify` | HLS push to CDN | GET | URL-templated |

### Required Response Format

Callbacks **must** return HTTP 200 with one of:

```
// Option 1: Plain integer
HTTP/1.1 200 OK
Content-Length: 1

0
```

```
// Option 2: JSON
HTTP/1.1 200 OK
Content-Type: application/json

{"code": 0, "msg": "OK"}
```

**Non-zero code or non-200 status disconnects the client.** This is the authentication mechanism — return `{"code": 1}` to reject a publisher.

### Authentication via Callbacks

Stream key authentication works through the `param` field:

1. Publisher connects: `rtmp://server/live/stream?key=my-secret-key`
2. SRS fires `on_publish` with `{ "stream": "stream", "param": "?key=my-secret-key" }`
3. Your handler parses `param`, validates the key
4. Return `{"code": 0}` to allow, `{"code": 1}` to reject

```typescript
// Example callback handler
app.post('/hooks/on-publish', async (c) => {
  const body = await c.req.json()
  const params = new URLSearchParams(body.param?.replace('?', ''))
  const key = params.get('key')

  if (!isValidStreamKey(key)) {
    return c.json({ code: 1 }) // Reject — SRS disconnects publisher
  }

  return c.json({ code: 0 }) // Allow
})
```

---

## HLS Configuration

```
vhost __defaultVhost__ {
    hls {
        enabled on;
        hls_fragment 2;       // Seconds per .ts segment (default: 10)
        hls_window 10;        // Total playlist duration in seconds (default: 60)
        hls_path ./objs/nginx/html;  // Where .m3u8 and .ts files are written
        hls_m3u8_file [app]/[stream].m3u8;  // Playlist filename pattern
        hls_ts_file [app]/[stream]-[seq].ts; // Segment filename pattern
    }
}
```

**Playback URL:** `http://host:8080/live/livestream.m3u8`

| Setting | Default | Purpose |
|---------|---------|---------|
| `hls_fragment` | 10s | Duration of each `.ts` segment |
| `hls_window` | 60s | Total sliding window of segments in playlist |
| `hls_path` | `./objs/nginx/html` | Directory for HLS output files |
| `hls_dispose` | 120s | How long to keep HLS files after stream ends |

Lower `hls_fragment` = lower latency but more HTTP requests from players.

---

## Full Configuration Reference

```
# Core
listen 1935;                    # RTMP port
max_connections 1000;           # Max concurrent connections
daemon off;                     # Run in foreground (for Docker)
srs_log_tank console;           # Log to stdout

# HTTP Server (HLS playback)
http_server {
    enabled on;
    listen 8080;
    dir /usr/local/srs/objs/nginx/html;
    crossdomain on;             # Enable CORS
}

# HTTP API (management)
http_api {
    enabled on;
    listen 1985;
    crossdomain on;             # Enable CORS
    auth {                      # Optional (v6.0.40+)
        enabled off;
        username admin;
        password admin;
    }
}

# Raw API (reload, etc.)
raw_api {
    enabled off;                # Disabled by default
    allow_reload on;
}

# Virtual host configuration
vhost __defaultVhost__ {
    # HLS
    hls {
        enabled on;
        hls_fragment 2;
        hls_window 10;
    }

    # HTTP Callbacks
    http_hooks {
        enabled on;
        on_publish http://api:3000/hooks/on-publish;
        on_unpublish http://api:3000/hooks/on-unpublish;
    }

    # DVR (recording)
    dvr {
        enabled off;
        dvr_path ./objs/nginx/html/[app]/[stream].[timestamp].flv;
        dvr_plan session;       # "session" = one file per stream, "segment" = split files
    }

    # Transcoding (requires FFmpeg)
    transcode {
        enabled off;
        ffmpeg /usr/local/bin/ffmpeg;
    }
}
```
