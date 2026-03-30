# ── Logging ──

log.stdout := true
log.file := false
log.level := 4
log.level := 4

# ── S3 Protocol (Garage) ──

settings.protocol.aws.endpoint := "http://snc-garage:3900"
settings.protocol.aws.region := "garage"

# ── Playlist ──
# S/NC Classics owns the playlist. S/NC TV falls back to Classics.

classics_playlist = playlist("/etc/liquidsoap/playlist.m3u", mode="normal", reload_mode="seconds", reload=0)

# ── Live Input (S/NC TV only) ──
# SRS forwards creator streams here via the on_forward callback.

live_source = input.rtmp(listen=true, "rtmp://0.0.0.0:1936/live/stream")

# ── Admin Queue (S/NC TV only) ──

queue_source = request.queue(id="admin-queue")

# ── Admin Queue (Classics) ──

classics_queue = request.queue(id="classics-queue")

# ── S/NC Classics: Fallback Chain ──
# Priority: admin queue > playlist > silence

classics = fallback(track_sensitive=false, [classics_queue, classics_playlist, mksafe(blank())])

# ── S/NC TV: Full Fallback Chain ──
# Priority: live creator > admin queue > classics stream

snc_tv = fallback(track_sensitive=false, [live_source, queue_source, classics])

# ── Metadata Tracking ──

snc_tv_uri = ref("")
snc_tv_title = ref("")
snc_tv.on_metadata(synchronous=false, fun(m) -> begin
  u = m["s3_uri"]
  snc_tv_uri := if u == "" then m["filename"] else u end
  snc_tv_title := m["title"]
end)

classics_uri = ref("")
classics_title = ref("")
classics.on_metadata(synchronous=false, fun(m) -> begin
  u = m["s3_uri"]
  classics_uri := if u == "" then m["filename"] else u end
  classics_title := m["title"]
end)

# ── Encoding ──

enc = %ffmpeg(
  format="flv",
  %video(codec="libx264", preset="ultrafast", b="2500k", g="60"),
  %audio(codec="aac", b="128k")
)

# ── Output: S/NC TV → SRS ──

playout_key = environment.get("PLAYOUT_STREAM_KEY", default="")
output.url(url="rtmp://snc-srs:1935/live/snc-tv?key=#{playout_key}", enc, snc_tv)

# ── Output: S/NC Classics → SRS ──

output.url(url="rtmp://snc-srs:1935/live/channel-classics?key=#{playout_key}", enc, classics)

# ── Harbor HTTP Endpoints ──

settings.harbor.bind_addrs := ["0.0.0.0"]

# Health check
harbor.http.register(port=8888, method="GET", "/health", fun(_req, res) -> begin
  res.data("ok")
end)

# S/NC TV: now-playing (existing path — backward compatible)
harbor.http.register(port=8888, method="GET", "/now-playing", fun(_req, res) -> begin
  e = snc_tv.elapsed()
  r = snc_tv.remaining()
  # Clamp infinity/nan to -1 for live sources where duration is unknown
  safe_elapsed = if e == infinity or e != e then -1. else e end
  safe_remaining = if r == infinity or r != r then -1. else r end
  res.json({
    uri = snc_tv_uri(),
    title = snc_tv_title(),
    elapsed = safe_elapsed,
    remaining = safe_remaining
  })
end)

# S/NC TV: skip
harbor.http.register(port=8888, method="POST", "/skip", fun(_req, res) -> begin
  snc_tv.skip()
  res.data("skipped")
end)

# S/NC TV: queue
harbor.http.register(port=8888, method="POST", "/queue", fun(req, res) -> begin
  queue_source.push.uri(req.body())
  res.data("queued")
end)

# S/NC Classics: now-playing
harbor.http.register(port=8888, method="GET", "/classics/now-playing", fun(_req, res) -> begin
  e = classics.elapsed()
  r = classics.remaining()
  safe_elapsed = if e == infinity or e != e then -1. else e end
  safe_remaining = if r == infinity or r != r then -1. else r end
  res.json({
    uri = classics_uri(),
    title = classics_title(),
    elapsed = safe_elapsed,
    remaining = safe_remaining
  })
end)

# S/NC Classics: skip — advance playlist cursor then skip the fallback
# Playlist skip ensures the cursor advances (fallback skip alone replays the same track).
# Fallback skip ends a queued track when the queue is active (playlist skip is a no-op then).
harbor.http.register(port=8888, method="POST", "/classics/skip", fun(_req, res) -> begin
  classics_playlist.skip()
  classics.skip()
  res.data("skipped")
end)

# S/NC Classics: queue
harbor.http.register(port=8888, method="POST", "/classics/queue", fun(req, res) -> begin
  classics_queue.push.uri(req.body())
  res.data("queued")
end)

# Reload playlist on demand (called by API after regeneration)
harbor.http.register(port=8888, method="POST", "/reload-playlist", fun(_req, res) -> begin
  classics_playlist.reload()
  res.data("reloaded")
end)
