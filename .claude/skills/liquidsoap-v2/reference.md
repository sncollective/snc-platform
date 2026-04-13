# Liquidsoap v2.4 API Reference

## Settings

Settings use the `:=` operator. List all available settings with `liquidsoap --list-settings`.

```liquidsoap
# Logging
log.stdout := true              # Log to stdout (for Docker)
log.file := false               # Disable file logging
log.level := 4                  # 1=critical, 2=severe, 3=important, 4=info, 5=debug

# Harbor (HTTP server)
settings.harbor.bind_addrs := ["0.0.0.0"]   # Listen on all interfaces
```

---

## Sources

### Core Concepts

A source is the fundamental unit of streaming in Liquidsoap. Each source emits:
- **Frames** — small chunks of media samples
- **Metadata** — key-value pairs (artist, title, filename, etc.)
- **Track marks** — signals indicating when tracks start or end

Sources are either **infallible** (guaranteed to produce output) or **fallible** (may become unavailable). Outputs require infallible sources — use `fallback()` or `mksafe()` to make fallible sources safe.

Liquidsoap performs **liveness analysis at startup**, warning when source graphs may fail unexpectedly.

### Execution Model

Liquidsoap uses a **clock-driven streaming loop**. During each tick:
1. Output requests a frame
2. Output queries its source
3. That source queries its dependencies recursively
4. Elementary sources produce actual data
5. Data flows back up the chain

**Critical constraint:** The streaming loop must remain fast. Expensive operations (remote downloads, playlist reloading, metadata verification) are offloaded to background threads. Remote files are pre-downloaded to temporary storage before playback.

### `playlist(path, options)`

Play files from a playlist (M3U, PLS, XSPF) or directory.

```liquidsoap
playlist(
  ~mode="normal",         # "normal" | "randomize" | "random"
  ~reload=0,              # Seconds between reloads (0 = never)
  ~reload_mode="seconds", # "seconds" | "rounds" | "watch"
  path                    # File path, directory, or HTTP/HTTPS URL
) -> source
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `mode` | `"normal"` | `"normal"` = sequential, `"randomize"` = shuffle on load, `"random"` = random each track |
| `reload` | `0` | How often to reload the playlist (0 = disabled — use `.reload()` for on-demand) |
| `reload_mode` | `"seconds"` | `"seconds"` = timer, `"rounds"` = after N full cycles, `"watch"` = inotify file watch, `"never"` = never reload |
| `loop` | `true` | Loop the playlist when all tracks have played |
| `max_fail` | `10` | After this many consecutive resolution failures, call `on_fail` |
| `on_reload` | `fun (_) -> ()` | Callback fired after playlist reloads. Receives the playlist URI. |
| `prefetch` | `null` | How many requests to queue in advance (null = auto) |
| `timeout` | `null` | Timeout in seconds for request resolution (null = use global setting) |

```liquidsoap
# Local directory
s = playlist("/music/")

# Remote M3U with periodic reload
s = playlist(reload=600, reload_mode="seconds", "http://server/playlist.m3u")

# Watch file for changes (inotify — does NOT work across Docker bind mounts)
s = playlist(reload_mode="watch", "/etc/liquidsoap/playlist.m3u")

# On-demand reload only (pair with .reload() via harbor endpoint)
s = playlist(reload=0, "/etc/liquidsoap/playlist.m3u")
```

**Behavior:** Remote URLs (including `s3://`) are pre-downloaded to a temp directory before playback. Failed tracks are skipped with a log warning. If all tracks fail, the source becomes unavailable (fallible).

**Docker caveat:** `reload_mode="watch"` uses inotify, which does not propagate across Docker bind mounts. When the playlist file is written on the host and bind-mounted into a container, inotify events inside the container are not triggered. Use `reload=0` with `.reload()` called from a harbor endpoint instead.

#### Playlist Queue Parameters

All queued sources (including `playlist`) share these parameters for managing the internal prefetch queue:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `length` | `10` | Seconds of estimated remaining time before resolving the next request |
| `default_length` | varies | Duration assumed when metadata doesn't provide one |
| `conservative` | `false` | When `true`, ensures at least one track is always queued — useful when resolution is slow (remote files, loaded servers) |

---

### `input.rtmp(uri, options)`

Receive or pull RTMP streams.

```liquidsoap
input.rtmp(
  ~listen=false,      # true = act as RTMP server, false = connect to remote
  ~max_buffer=5.,     # Max buffered data in seconds
  uri                 # rtmp://host:port/app/streamkey
) -> source
```

**Server mode (receive incoming streams):**
```liquidsoap
live = input.rtmp(listen=true, "rtmp://0.0.0.0:1936/live/stream")
```
Port is specified in the URL. Produces a **fallible** source — unavailable when no publisher is connected.

**Client mode (pull from remote):**
```liquidsoap
remote = input.rtmp("rtmp://remote-server:1935/live/stream")
```

---

### `single(path)`

Loop a single file forever. Useful as emergency fallback. Produces an **infallible** source.

```liquidsoap
silence = single("silence.mp3")
```

---

### `mksafe(source)`

Convert a fallible source to infallible by inserting silence/blank when unavailable.

```liquidsoap
safe_live = mksafe(input.rtmp(listen=true, "rtmp://0.0.0.0:1936/live/stream"))
```

---

### `request.queue(options)`

Dynamic queue source — push requests at runtime via script or HTTP. **Push-only** — items can be added but not removed or reordered.

```liquidsoap
request.queue(
  ~id="",              # Source ID (used for telnet addressing)
) -> source
```

**Methods on the returned source:**
- `.push(request)` — push a request object (from `request.create`)
- `.push.uri(uri)` — push a URI string directly (shorthand)
- `.length()` — number of queued requests

```liquidsoap
queue = request.queue(id="my-queue")

# Push a URI directly (preferred for simple cases)
queue.push.uri("s3://bucket/file.mp4")

# Push a request object (when you need request options)
r = request.create("/path/to/file.mp3")
queue.push(r)

# Combine with harbor HTTP for external control
harbor.http.register(port=8888, method="POST", "/queue", fun(req, res) -> begin
  queue.push.uri(req.body())
  res.data("queued")
end)
```

**Behavior:** Queue source is fallible — unavailable when empty. Use in a `fallback()` chain so playlist resumes when queue empties. Has a dual-queue structure internally: the secondary queue is user-controlled (push), the primary queue is automatic (prefetch/resolve).

---

### `request.equeue(options)`

Editable queue source — extends `request.queue` with removal and reordering capabilities. Allows inspection and manipulation of the secondary queue via the command server.

```liquidsoap
request.equeue(
  ~id="",              # Source ID
) -> source
```

Same methods as `request.queue`, plus:
- Queue inspection (view pending items)
- Request removal
- Request exchange/reordering

Controlled via the command server (telnet). Useful when admin needs to remove or reorder queued items, not just append.

---

### `request.create(uri)`

Create a request object from a URI string.

```liquidsoap
r = request.create("/path/to/file.mp3")
r = request.create("s3://bucket/key.mp4")
r = request.create("http://example.com/stream.mp3")
```

Used with `queue.push(request)` when you need the request object. For simple URI push, prefer `queue.push.uri(uri)` instead.

---

## Operators

### `fallback(sources, options)`

Select the first available source from a priority list.

```liquidsoap
fallback(
  ~track_sensitive=true,   # true = switch at track end, false = switch immediately
  ~transitions=null,       # List of transition functions for crossfade
  sources                  # [source] — priority order, first available wins
) -> source
```

```liquidsoap
live = input.rtmp(listen=true, "rtmp://0.0.0.0:1936/live/stream")
backup = playlist("/backup/")
emergency = single("silence.mp3")

# Instant switching for live streaming
radio = fallback(track_sensitive=false, [live, backup, emergency])
```

**Behavior:**
- Checks sources left-to-right, uses the first one that's available
- `track_sensitive=false`: switches mid-track when a higher-priority source appears or disappears
- `track_sensitive=true` (default): waits for current track to end before switching

**Skip behavior:** Calling `.skip()` on a `fallback` source ends the current track, but does **not** advance the active child source's internal cursor. The fallback then re-requests from the highest-priority available child, which may return the same track. To advance to the next track, call `.skip()` on the **child source** directly (e.g., `playlist.skip()` instead of `fallback.skip()`).

---

### `switch(conditions)`

Time-based or condition-based source switching. Selects the first source whose predicate returns `true`.

```liquidsoap
radio = switch([
  ({ 6h-22h }, daytime_playlist),
  ({ true }, nighttime_playlist),
])
```

Time predicates use Liquidsoap's time syntax:
- `{ 9h }` — true at 9:00 AM
- `{ 6h-22h }` — true between 6 AM and 10 PM
- `{ 1w }` — true on Monday (1=Monday, 7=Sunday)
- `{ true }` — always true (default/catch-all)

**Use cases:** Time-slot programming, EPG-style scheduling, day/night rotation.

---

### `cross(source, transition)`

Apply a transition function at track boundaries. The transition function receives the ending and starting tracks and controls how they overlap.

```liquidsoap
# Smart crossfade with automatic level detection
radio = cross.smart(radio)
```

#### `cross.smart()` Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `fade_in` | `3.` | Fade-in duration in seconds |
| `fade_out` | `3.` | Fade-out duration in seconds |
| `high` | `-15.` | dB threshold for "loud" |
| `medium` | `-32.` | dB threshold for "medium" |
| `margin` | `4.` | dB margin for detecting incompatible levels |

**Transition strategies** (chosen automatically based on volume analysis):
1. **Crossed fade-in/out** — both tracks below medium, within margin
2. **Crossed fade-out only** — new track significantly louder
3. **Crossed fade-in only** — ending track significantly louder
4. **No fade** — ending track already very low
5. **Default** — volumes incompatible

#### Autocue (Automated Cue Points)

```liquidsoap
enable_autocue_metadata()
```

Automatically computes cue points and crossfade metadata using FFmpeg analysis. Alternative: the external [autocue](https://github.com/Moonbase59/autocue) project.

---

## Source Methods

In v2.4+, control methods live on the source object, not as standalone `source.X()` functions.

### `.skip()`

Skip the current track. The source advances to the next track immediately.

```liquidsoap
my_playlist.skip()
```

Type: `() -> unit`

**Important:** Call `.skip()` on the source that owns the track cursor (e.g., the `playlist` source), not on a wrapping operator like `fallback`. See the `fallback` section for details.

### `.elapsed()`

Elapsed time in the current track (seconds, exact).

```liquidsoap
t = radio.elapsed()
```

Type: `() -> float`

### `.remaining()`

Estimated remaining time in the current track (seconds). Accurate for file-based sources, estimated for live.

```liquidsoap
r = radio.remaining()
```

Type: `() -> float`

### `.on_metadata(~synchronous, callback)`

Register a callback that fires when a new track starts or metadata changes. **Requires `synchronous` parameter in v2.4** — omitting it causes `Error 15: Missing arguments in function application: synchronous : bool`.

```liquidsoap
# synchronous=false — non-blocking (use for metadata tracking)
radio.on_metadata(synchronous=false, fun(m) -> begin
  log("Now playing: #{m["filename"]}")
end)

# synchronous=true — blocks playback until callback completes
radio.on_metadata(synchronous=true, fun(m) -> begin
  # do something that must finish before playback continues
end)
```

Type: `(~synchronous : bool, ([string * string]) -> unit) -> unit`

The metadata `m` is an association list of string pairs. Common keys:
- `"filename"` — file path or URI of the current track
- `"title"` — track title (if set in file metadata)
- `"artist"` — artist name
- `"duration"` — duration as string (may not always be present)

Access values with `m["key"]` — returns empty string if key not found.

### `.on_track(~synchronous, callback)`

Register a callback that fires at the start of each new track. **Requires `synchronous` parameter in v2.4.**

```liquidsoap
radio.on_track(synchronous=false, fun(m) -> begin
  log("New track started")
end)
```

### `.insert_metadata(metadata)`

Insert metadata into the source at runtime. Changed from standalone operator to method in v2.4.

```liquidsoap
s.insert_metadata([("title", "My Song"), ("artist", "Someone")])
```

Type: `([string * string]) -> unit`

### `.reload()`

Reload the playlist from disk. **Available on `playlist()` sources only** — not on `fallback`, `switch`, or other source types.

```liquidsoap
s = playlist("/path/to/playlist.m3u", mode="normal", reload=0)

# Reload from the original URI
s.reload()

# Reload and clear the prefetch queue
s.reload(empty_queue=true)

# Reload from a different URI
s.reload(uri="/path/to/other.m3u")
```

Type: `(?empty_queue : bool, ?uri : string?) -> unit`

| Parameter | Default | Description |
|-----------|---------|-------------|
| `empty_queue` | `false` | Clear queued/prefetched tracks before reloading |
| `uri` | `null` | Reload from a different URI (null = use original) |

**Use case:** Pair with `reload=0` to disable automatic reloading. Call `.reload()` from a harbor HTTP endpoint when the playlist file is updated externally (e.g., by an API writing an M3U). This avoids the inotify limitation with Docker bind mounts and prevents position resets from timer-based reloading.

```liquidsoap
# On-demand reload via harbor
harbor.http.register(port=8888, method="POST", "/reload-playlist", fun(_req, res) -> begin
  s.reload()
  res.data("reloaded")
end)
```

### `.length()`

Number of tracks in the playlist. Available on `playlist()` sources only.

```liquidsoap
n = s.length()
```

Type: `() -> int`

### `.remaining_files()`

List of track URIs remaining to be played in the current cycle. Available on `playlist()` sources only.

```liquidsoap
files = s.remaining_files()
```

Type: `() -> [string]`

### `.current()`

Get the request currently being played. Returns null if nothing is playing. Available on `playlist()` sources only.

```liquidsoap
req = s.current()
```

Type: `() -> request?`

---

## Outputs

### `output.url(url, encoder, source, options)`

Push a stream to a remote URL via FFmpeg.

```liquidsoap
output.url(
  ~fallible=false,     # Accept fallible source (stops/restarts with it)
  ~on_error=null,      # Error callback
  url,                 # Target URL (rtmp://, srt://, etc.)
  encoder,             # FFmpeg encoder (%ffmpeg(...))
  source               # Audio/video source
) -> output
```

```liquidsoap
# RTMP push with copy passthrough
output.url(
  url="rtmp://srs:1935/live/channel-main",
  %ffmpeg(format="flv", %audio.copy, %video.copy),
  source
)

# RTMP push with transcoding
enc = %ffmpeg(
  format="flv",
  %video(codec="libx264", preset="ultrafast", b="2600k"),
  %audio(codec="aac", b="128k")
)
output.url(url="rtmp://srs:1935/live/channel-main", enc, source)
```

**Callbacks (v2.4 pattern):**
```liquidsoap
o = output.url(url="rtmp://...", encoder, source)
o.on_connect(synchronous=true, fun () -> log("RTMP connected"))
o.on_disconnect(synchronous=true, fun () -> log("RTMP disconnected"))
```

**Multi-output (same source, different codecs):**
```liquidsoap
output.url(url="rtmp://srs/live/hq", %ffmpeg(format="flv", %video(codec="libx264", b="4000k"), %audio(codec="aac", b="192k")), source)
output.url(url="rtmp://srs/live/lq", %ffmpeg(format="flv", %video(codec="libx264", b="1000k"), %audio(codec="aac", b="96k")), source)
```

---

### `output.file(encoder, path, source)`

Write to a local file (HLS segments, recordings).

```liquidsoap
output.file(
  %ffmpeg(format="mpegts", %audio.copy, %video.copy),
  "/var/www/hls/stream-%d.ts",
  source
)
```

---

### `output.file.hls(streams, directory, source, options)`

Write HLS output to disk (playlists + segments).

```liquidsoap
output.file.hls(
  ~segment_duration=2.0,      # Segment length in seconds
  ~segments=5,                # Segments retained in media playlist
  ~segments_overhead=5,       # Extra segments kept for late listeners
  ~playlist="live.m3u8",      # Master playlist filename
  ~persist_at=null,           # State file for restart continuity
  ~on_file_change=null,       # Callback when segments written (for S3 sync)
  ~segment_name=null,         # Custom segment naming function
  streams,                    # [("name", encoder)] tuples
  directory,                  # Output directory
  source
)
```

**Audio-only HLS:**
```liquidsoap
aac_lofi = %ffmpeg(
  format = "mpegts",
  %audio(codec = "aac", channels = 2, ar = 44100)
)

output.file.hls(
  playlist="live.m3u8",
  segment_duration=6.,
  [("lofi", aac_lofi)],
  "/var/www/hls",
  source
)
```

**Video HLS with keyframe alignment:**
```liquidsoap
enc = %ffmpeg(
  format="mpegts",
  %video(codec="libx264", b="2500k", g="60", x264opts="keyint=60:min-keyint=60"),
  %audio(codec="aac", b="128k")
)

output.file.hls(
  playlist="live.m3u8",
  segment_duration=2.,
  [("main", enc)],
  "/var/www/hls",
  source
)
```

**Multi-rendition HLS:**
```liquidsoap
hq = %ffmpeg(format="mpegts", %video(codec="libx264", b="4000k"), %audio(codec="aac", b="192k"))
lq = %ffmpeg(format="mpegts", %video(codec="libx264", b="1000k"), %audio(codec="aac", b="96k"))

output.file.hls(
  playlist="live.m3u8",
  [("hq", hq), ("lq", lq)],
  "/var/www/hls",
  source
)
```

**Metadata:** Supports ID3 timed metadata in MPEG-TS segments. `id3=true` (default) inserts metadata, `replay_id3=true` repeats latest metadata at each segment start.

**`output.harbor.hls`** serves HLS directly from Liquidsoap's harbor (same options + `port` and `path`). Not recommended for public traffic — use a proper web server or CDN in front.

---

## FFmpeg Encoder

### Syntax

```liquidsoap
%ffmpeg(
  format="flv",                    # Container format
  %audio(codec="aac", b="128k"),   # Audio settings
  %video(codec="libx264", b="2600k")  # Video settings
)
```

### Copy Passthrough (No Re-encoding)

```liquidsoap
%ffmpeg(format="flv", %audio.copy, %video.copy)
```

Passes encoded audio/video through without re-encoding. Source must already be in a compatible codec.

### Format Values

| Format | Use Case |
|--------|----------|
| `"flv"` | RTMP streaming |
| `"mpegts"` | HLS segments, MPEG-TS |
| `"mp4"` | MP4 recording |
| `"matroska"` | MKV recording |

### Video Codec Options

```liquidsoap
%video(
  codec="libx264",
  preset="ultrafast",     # ultrafast → veryslow
  b="2600k",              # Bitrate
  crf="23",               # Quality (lower = better, 0-51)
  tune="zerolatency",     # Tune for use case
  g="60",                 # GOP size (keyframe interval in frames)
)
```

### Audio Codec Options

```liquidsoap
%audio(
  codec="aac",
  b="128k",               # Bitrate
  ar="44100",             # Sample rate
  ac="2",                 # Channels
)
```

---

## Harbor HTTP Server

Liquidsoap's built-in HTTP server for remote control and introspection.

### Express-Style API (Recommended)

```liquidsoap
harbor.http.register(
  ~port=8000,        # Listen port
  ~method="GET",     # HTTP method
  path,              # URL path (supports :named params)
  handler            # (request, response) -> unit
)
```

**Request object fields:**
- `body` — **function**, not a string. Call `req.body()` to read content. Type: `(?timeout : float) -> string`
- `data` — string getter, returns data incrementally
- `headers` — request headers
- `http_version` — protocol version
- `method` — HTTP verb
- `path` — URL path
- `query` — query parameters and named path fragments

**Response methods:**
- `res.status_code(int)` — set HTTP status (default 200)
- `res.status_message(string)` — set status message
- `res.headers(list)` — replace all headers
- `res.header(key, value)` — set individual header
- `res.http_version(string)` — set protocol version
- `res.content_type(string)` — set Content-Type
- `res.data(string)` — set response body as string
- `res.json(table)` — set JSON response with appropriate content-type
- `res.html(string)` — set HTML response
- `res.redirect(url)` — HTTP redirect

### Simple API

```liquidsoap
harbor.http.register.simple(port=8080, method="GET", path, fun(request) -> begin
  http.response(content_type="text/html", data="<p>ok</p>")
end)
```

The simple API returns an `http.response` object. Useful for quick handlers.

### Named Path Parameters

```liquidsoap
harbor.http.register(port=8888, method="POST", "/skip/:station", fun(req, res) -> begin
  let station = req.query["station"]
  # ... handle skip
  res.data("skipped")
end)
```

### Regexp Routing

```liquidsoap
harbor.http.register.regexp(port=8888, method="GET", "^/api/v[0-9]+/status$", fun(req, res) -> begin
  res.json({ status = "ok" })
end)
```

### Middleware

```liquidsoap
harbor.http.middleware.register(harbor.http.middleware.cors(origin="example.com"))
```

### HTTPS/TLS

```liquidsoap
transport = http.transport.ssl(
  certificate="/path/to/cert",
  key="/path/to/key",
  password="optional"
)

harbor.http.register(transport=transport, port=8443, ...)
```

A single port supports only one transport type.

### Health Check Example

```liquidsoap
harbor.http.register(port=8888, method="GET", "/health", fun(_req, res) -> begin
  res.data("ok")
end)
```

### JSON Response

```liquidsoap
harbor.http.register(port=8888, method="GET", "/status", fun(_req, res) -> begin
  res.json({ status = "ok", uptime = 42 })
end)
```

---

## HTTP Client

Native HTTP functions for outbound requests. Prefer these over shelling out to `curl` via `process.run` — they're non-blocking, have no external dependency, and integrate with Liquidsoap's type system.

### `http.post`

```liquidsoap
http.post(
  ?headers : [string * string],   # List of (name, value) header pairs
  ?data : {string},               # Request body (string getter)
  ?timeout : float?,              # Request timeout in seconds
  ?redirect : bool,               # Follow redirects (default: true)
  string                          # URL (unlabeled)
) -> string
```

**Example — JSON webhook:**
```liquidsoap
ignore(http.post(
  headers=[("Content-Type", "application/json")],
  data='{"uri":"#{current_uri()}","title":"#{current_title()}"}',
  "http://api:3000/api/playout/track-event?secret=#{secret}"
))
```

**Example — fire-and-forget in a metadata callback:**
```liquidsoap
source.on_metadata(synchronous=false, fun(m) -> begin
  ignore(http.post(
    headers=[("Content-Type", "application/json")],
    data='{"title":"#{m["title"]}"}',
    "http://api:3000/webhook"
  ))
end)
```

### `http.get`

```liquidsoap
http.get(
  ?headers : [string * string],
  ?timeout : float?,
  ?redirect : bool,
  string                          # URL
) -> string
```

### `http.put`

Same signature as `http.post`.

### `http.delete`

Same signature as `http.get`.

---

## File I/O

### `file.write(data, ~perms, ~append, ~atomic, ~temp_dir, path)`

Write data to a file.

```liquidsoap
file.write(
  data,                  # {string?} — callback returning content (or string directly)
  ~perms=0o644,          # int — POSIX file permissions
  ~append=false,         # bool — append instead of overwrite
  ~atomic=false,         # bool — write to temp file then rename (safe for concurrent readers)
  ~temp_dir=null,        # string? — directory for temp file when atomic=true
  path                   # string — target file path
) -> unit
```

```liquidsoap
# Simple write (overwrites)
file.write(data="line1\nline2\n", "/etc/liquidsoap/playlist.m3u")

# Atomic write (safe for concurrent readers like playlist())
file.write(data="new content", atomic=true, "/etc/liquidsoap/playlist.m3u")

# Append to a log
file.write(data="#{time()}: event\n", append=true, "/var/log/liquidsoap/events.log")
```

**Use case:** Writing playlist files from harbor HTTP endpoints. Pair with `playlist.reload()` to update playout content via API calls.

### `file.contents(path)`

Read the entire contents of a file as a string.

```liquidsoap
file.contents(path) -> string
```

```liquidsoap
content = file.contents("/etc/liquidsoap/playlist.m3u")
```

### `file.exists(path)`

Check if a file exists.

```liquidsoap
file.exists(path) -> bool
```

### Other File Utilities

| Function | Signature | Description |
|----------|-----------|-------------|
| `file.read(path)` | `(string) -> (() -> string)` | Streaming read — returns getter, `""` when done |
| `file.lines(path)` | `(string) -> [string]` | Read file as list of lines |
| `file.remove(path)` | `(string) -> unit` | Delete a file |
| `file.copy(~recursive, ~force, ~preserve, src, dst)` | `(..., string, string) -> unit` | Copy files |
| `file.size(path)` | `(string) -> int` | File size in bytes |
| `file.mtime(path)` | `(string) -> float` | Last modification time |
| `file.is_directory(path)` | `(string) -> bool` | Check if path is a directory |

---

## Process Execution

Run external commands from Liquidsoap. All process functions take the **entire shell command as a single string** — there is no separate binary + args parameter.

### `process.run`

Run a command, capture stdout/stderr/status.

```liquidsoap
process.run(
  ?env : [string * string],      # Environment variables (key-value pairs)
  ?inherit_env : bool,            # Inherit parent env (default: true)
  ?stdin : string,                # Data piped to process stdin
  ?rwdirs : [string],             # Sandbox: read/write directories
  ?rodirs : [string],             # Sandbox: read-only directories
  ?network : bool?,               # Sandbox: allow network access (null = sandbox default)
  ?timeout : float?,              # Kill process after N seconds (null/negative = no timeout)
  string                          # Full shell command as a single string
) -> unit
```

**Result methods** (accessible on the return value):
- `.stdout` → `string` — captured stdout
- `.stderr` → `string` — captured stderr
- `.status` → `string.{code : int, description : string}` — `"exit"`, `"killed"`, `"stopped"`, or `"exception"`

**Example:**
```liquidsoap
result = process.run("curl -sf http://api:3000/health")
if result.status == "exit" and result.status.code == 0 then
  log("API healthy: #{result.stdout}")
end
```

**Common mistake:** passing binary and args as separate parameters. The function only accepts one unlabeled string:

```liquidsoap
# Wrong — list is a second unlabeled argument, function only takes one
process.run("curl", ["-s", "http://example.com"])

# Right — entire command in one string
process.run("curl -s http://example.com")
```

### `process.read`

Run a command, return stdout directly.

```liquidsoap
process.read(
  ?timeout : float?,
  ?env : [string * string],
  ?inherit_env : bool,
  ?log_errors : bool,             # Log stderr on failure (default: true)
  string                          # Full shell command
) -> string
```

### `process.read.lines`

Like `process.read`, but returns stdout split into lines.

```liquidsoap
process.read.lines(command) -> [string]
```

### `process.test`

Run a command, return true if exit code is 0.

```liquidsoap
process.test(command) -> bool
```

**Note:** For HTTP requests, prefer native `http.post` / `http.get` over shelling out — no escaping issues, no external dependency, non-blocking.

---

## Request Lifecycle

Requests follow a six-stage process:

1. **Creation** — URI passed via `request.create` or playlist entry
2. **Protocol resolution** — Liquidsoap interprets the URI scheme (`s3://`, `http://`, `annotate:`, etc.)
3. **Chained resolution** — some protocols yield another URI, triggering recursive resolution
4. **Local file reached** — resolution terminates at a local disk file
5. **Decoder selection** — file format matched to appropriate decoder
6. **Playback** — decoded stream sent to source

**Important:** A request can resolve successfully but remain unplayable if the format lacks decoder support.

---

## Protocols

### `annotate:` — Metadata Injection

Inject custom metadata into a request before resolution. The metadata is available in `on_metadata` callbacks after the track starts playing.

**Syntax:**
```
annotate:key="value",key2="value2":uri
```

**Example in M3U playlist:**
```
#EXTM3U
#EXTINF:120,Track Title
annotate:s3_uri="s3://bucket/playout/abc123/source/file.mp4":s3://bucket/playout/abc123/source/file.mp4
```

When Liquidsoap loads this entry:
1. `annotate:` extracts `s3_uri` and attaches it as metadata
2. The remaining URI (`s3://...`) is resolved via the S3 protocol (downloaded to temp file)
3. `on_metadata` receives both `m["s3_uri"]` (original S3 URI) and `m["filename"]` (temp path)

**Cue points via annotate:**
```
annotate:cue_in="3.",cue_out="23.":/music/song.mp3
```

`cue_in` and `cue_out` must be set at the request level (via `annotate:`) so they're available to decoders. Setting them later in the chain has no effect.

**Scope:** `annotate:` metadata is per-request. It does not persist across track boundaries. Each playlist entry or queued request needs its own `annotate:` wrapper.

### `s3://` — S3 Fetch

Downloads files via the AWS CLI.

**Requirements:** AWS CLI installed in the container. Environment variables:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_DEFAULT_REGION`

**Custom endpoint (for Garage/MinIO):**
```liquidsoap
settings.protocol.aws.endpoint := "http://garage:3900"
settings.protocol.aws.region := "garage"
```

**Metadata caveat:** When Liquidsoap resolves an `s3://` URI, it downloads to a temp path (`/tmp/liq-process*.{ext}`). `on_metadata` receives `m["filename"]` with this temp path, not the original S3 URI. Use `annotate:` to preserve the original URI.

### `process:` — Custom Process Protocol

Resolve a request using an arbitrary external process. The command can reference the input URI and must produce a local file.

**Syntax:**
```
process:<extname>,<cmd>[:uri]
```

**Example — fetch via curl with presigned URL:**
```
process:mp4,curl -sL -o $(output) "$(input)":<presigned-https-url>
```

- `$(output)` — temp file path Liquidsoap expects the result in
- `$(input)` — the URI after the final `:` (optional)
- `<extname>` — file extension hint for decoder selection

**Use case:** Replace `s3://` protocol with presigned HTTPS URLs to eliminate AWS CLI dependency. Generate presigned URLs in the API, write them into the playlist wrapped in `process:`.

### `http://` / `https://` — HTTP Download

Downloads media via curl before playback.

```
http://example.com/song.mp3
https://cdn.example.com/media/track.mp4
```

### `autocue:` — Automatic Cue Points

Automatically computes cue-in, cue-out, and crossfade metadata using FFmpeg analysis.

```
autocue:s3://bucket/file.mp4
```

### `youtube-dl:` / `youtube-pl:` — YouTube

Resolve via youtube-dl (or yt-dlp).

```
youtube-dl:https://www.youtube.com/watch?v=...
youtube-pl:https://www.youtube.com/playlist?list=...
```

### `synth:` — Audio Synthesis

Generate synthetic audio.

```
synth:shape=sine,frequency=440.,duration=10.
```

### `tmp:` — Mark as Temporary

Mark a URI so the resolved file is deleted after playback.

```
tmp:/path/to/temp-file.mp3
```

### Other Protocols

| Protocol | Purpose |
|----------|---------|
| `file:///path` | Local file (explicit) |
| `copy:/path` | Copy file to temp before playback |
| `fallible:uri` | Prevent URI from being treated as infallible |
| `stereo:uri` | Convert to stereo (decodes to WAV) |
| `ffmpeg:uri` | Decode to WAV using FFmpeg |
| `replaygain:uri` | Compute ReplayGain value |
| `lufs_track_gain:uri` | Compute LUFS track gain correction |
| `mpd:tag=value` | Find files via MPD |
| `gtts:text` | Google TTS |
| `polly:text` | AWS Polly TTS |
| `say:text` / `pico2wave:text` / `text2wave:text` / `macos_say:text` | Various TTS engines |

---

## Scheduling

### `cron.add(pattern, callback)`

Schedule tasks using standard cron syntax.

```liquidsoap
# Every day at noon
cron.add("0 12 * * *", { log("It's noon!") })

# Every 5 minutes
cron.add("*/5 * * * *", { log("5 minutes passed") })

# Weekdays at 2:15 PM
cron.add("15 14 * * 1-5", { log("Weekday afternoon") })
```

**Shorthands:** `@annually`, `@yearly`, `@daily`, `@hourly`, `@monthly`, `@weekly`

**Task management:**
```liquidsoap
# Get task ID for later removal
let {id} = cron.add("0 12 * * *", { log("Noon") })

# Explicit ID
cron.add(id="midnight-task", "0 0 * * *", { log("Midnight") })

# Remove a scheduled task
cron.remove("midnight-task")
```

### `thread.run(callback, options)`

Execute tasks at regular intervals.

```liquidsoap
# Log every 10 minutes
thread.run(every=600., { log("10 minutes have passed.") })

# Queue a jingle every hour
thread.run(every=3600., { queue.push.uri("/path/to/hourly-jingle.mp3") })
```

### `thread.when(predicate, callback)`

Run tasks when time-based conditions are met.

```liquidsoap
# Run at 9 AM
thread.when({ 9h }, { log("It's 9 AM!") })

# Queue track at 11:59 PM
thread.when({ 23h59m }, { queue.push.uri("/path/to/midnight-track.mp3") })
```

### Time Predicates

Used in `switch`, `thread.when`, and conditional logic:

```liquidsoap
{ 9h }          # At 9:00
{ 9h-17h }      # Between 9 AM and 5 PM
{ 1w }          # Monday (1=Mon, 7=Sun)
{ 1w-5w }       # Monday through Friday
{ true }        # Always (catch-all)
```

---

## Clocks

### Core Concept

Each source belongs to a single clock, fixed at creation. The clock controls the pace at which that source operates. Multiple clocks can coexist when sources operate at different rates.

### Why Multiple Clocks

- Soundcards run at slightly different rates
- Network inputs (SRT, RTMP) have their own timing
- Operators like `crossfade` temporarily accelerate consumption
- Recording and streaming may need independent timing

### Clock Assignment

```liquidsoap
c = s.clock                    # Access a source's clock
clock.assign_new(sync="none", [source])   # Create a new clock for a source
```

### Bridging Clock Domains

```liquidsoap
buffered = buffer(source_in_one_clock)
```

`buffer()` creates a queue managing data between sources on different clocks. Severe drift can cause overflow/underflow.

### Practical Example — Isolate Network from Recording

```liquidsoap
input = input.alsa()

# Icecast with independent clock + buffer
icecast_source = mksafe(buffer(input))
output.icecast(%mp3, mount="live", icecast_source)

# File recording on input's native clock
output.file(%mp3, "recording.mp3", input)
```

### Common Error: Latency Control Conflict

```
This source may control its own latency and cannot be used with this operator.
```

Happens when combining a source with its own clock (e.g., `input.srt`) with an operator that needs temporal control (e.g., `crossfade`). Use `buffer()` to bridge.

---

## Scripting Basics

### Variables

```liquidsoap
x = 5                    # Immutable binding
let x = 5                # Same — both are immutable
let [a, b] = [1, 2]     # Destructuring
```

### Mutable References

```liquidsoap
# Create a mutable reference
counter = ref(0)
name = ref("")

# Read the current value — call it as a function
current = counter()

# Assign a new value
counter := counter() + 1
name := "new value"
```

**IMPORTANT:** Dereference with `counter()` (function call), NOT `!counter` (that's OCaml, not Liquidsoap).

### Strings

```liquidsoap
msg = "Now playing: #{title}"   # Interpolation with #{...}
full = "Hello" ^ " " ^ "World" # Concatenation with ^
```

### Functions

```liquidsoap
def square(x) =
  x * x
end

def greet(~name="World") =    # Labeled parameter with default
  "Hello, #{name}!"
end
```

### Conditionals

```liquidsoap
if condition then
  action_a
else
  action_b
end
```

### Try-Catch

```liquidsoap
result = try
  int_of_string(value)
catch err do
  0
end
```

**IMPORTANT:** The catch syntax is `catch err do ... end`, NOT `catch _ -> ... end`.

### Comments

```liquidsoap
# Single-line comment
```

---

## Docker Configuration

### Logging for Containers

```liquidsoap
log.stdout := true
log.file := false
log.level := 4
```

### Graceful Shutdown

Liquidsoap handles SIGTERM. Set appropriate grace period:

```yaml
# docker-compose.yml
services:
  liquidsoap:
    stop_grace_period: 30s
```

### Command

```yaml
command: liquidsoap /etc/liquidsoap/playout.liq
```

### Health Check

```yaml
healthcheck:
  test: ["CMD", "curl", "-sf", "http://localhost:8888/health"]
  interval: 10s
  timeout: 5s
  retries: 3
```

---

## Common Patterns

### Live-Over-Playlist (TV Model)

```liquidsoap
live = input.rtmp(listen=true, "rtmp://0.0.0.0:1936/live/stream")
playlist_source = playlist(reload=0, "/etc/liquidsoap/playlist.m3u")
radio = fallback(track_sensitive=false, [live, playlist_source])
output.url(url="rtmp://srs:1935/live/channel", %ffmpeg(format="flv", %audio.copy, %video.copy), radio)
```

### Live > Queue > Playlist (with HTTP control)

Full pattern for playout with admin controls via harbor HTTP:

```liquidsoap
# Sources
live = input.rtmp(listen=true, "rtmp://0.0.0.0:1936/live/stream")
queue = request.queue(id="admin-queue")
pl = playlist(reload=0, "/path/to/playlist.m3u")

# Fallback chain: live > queued items > playlist > silence
radio = fallback(track_sensitive=false, [live, queue, pl, mksafe(blank())])

# Track metadata via mutable refs
current_uri = ref("")
current_title = ref("")

radio.on_metadata(synchronous=false, fun(m) -> begin
  current_uri := m["filename"]
  current_title := m["title"]
end)

# Output
output.url(url="rtmp://srs:1935/live/channel", encoder, radio)

# HTTP: now-playing
harbor.http.register(port=8888, method="GET", "/now-playing", fun(_req, res) -> begin
  res.json({
    uri = current_uri(),
    title = current_title(),
    elapsed = radio.elapsed(),
    remaining = radio.remaining()
  })
end)

# HTTP: skip — call .skip() on the PLAYLIST, not the fallback
harbor.http.register(port=8888, method="POST", "/skip", fun(_req, res) -> begin
  pl.skip()
  res.data("skipped")
end)

# HTTP: queue a URI
harbor.http.register(port=8888, method="POST", "/queue", fun(req, res) -> begin
  queue.push.uri(req.body())
  res.data("queued")
end)
```

### Multi-Output (Same Source, Different Codecs / Simulcast)

```liquidsoap
output.url(url="rtmp://srs/live/hq", %ffmpeg(format="flv", %video(codec="libx264", b="4000k"), %audio(codec="aac", b="192k")), source)
output.url(url="rtmp://srs/live/lq", %ffmpeg(format="flv", %video(codec="libx264", b="1000k"), %audio(codec="aac", b="96k")), source)
```

Multiple `output.url` calls on the same source create independent output streams. Each re-encodes independently. Use for simulcast (same content to multiple RTMP destinations) or multi-rendition output.

### Resilient Fallback Chain

```liquidsoap
live = input.rtmp(listen=true, "rtmp://0.0.0.0:1936/live/stream")
primary = playlist("/playlists/primary.m3u")
backup = playlist("/playlists/backup.m3u")
emergency = single("silence.mp3")

radio = fallback(track_sensitive=false, [live, primary, backup, emergency])
```

### Time-Slot Programming (EPG-Style)

```liquidsoap
morning = playlist("/playlists/morning.m3u")
afternoon = playlist("/playlists/afternoon.m3u")
night = playlist("/playlists/night.m3u")

radio = switch([
  ({ 6h-12h }, morning),
  ({ 12h-22h }, afternoon),
  ({ true }, night),
])

output.url(url="rtmp://srs:1935/live/channel", encoder, radio)
```

### Queue Introspection via Harbor

Expose playlist state for admin UIs:

```liquidsoap
harbor.http.register(port=8888, method="GET", "/playlist-status", fun(_req, res) -> begin
  res.json({
    length = pl.length(),
    remaining_files = pl.remaining_files()
  })
end)
```
