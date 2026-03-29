# ── Logging ──

log.stdout := true
log.file := false

# ── S3 Protocol (Garage) ──

settings.protocol.aws.endpoint := "http://localhost:3900"
settings.protocol.aws.region := "garage"

# ── Shared Playlist ──
# Both S/NC TV and Classics read the same M3U file but maintain independent positions.

tv_playlist = playlist("/workspaces/SNC/platform/liquidsoap/playlist.m3u", mode="normal", reload_mode="watch", reload=10)
classics_playlist = playlist("/workspaces/SNC/platform/liquidsoap/playlist.m3u", mode="normal", reload_mode="watch", reload=10)

# ── Live Input (S/NC TV only) ──
# SRS forwards creator streams here via the on_forward callback.

live_source = input.rtmp(listen=true, "rtmp://0.0.0.0:1936/live/stream")

# ── Admin Queue (S/NC TV only) ──

queue_source = request.queue(id="admin-queue")

# ── S/NC TV: Full Fallback Chain ──
# Priority: live creator > admin queue > playlist > silence

snc_tv = fallback(track_sensitive=false, [live_source, queue_source, tv_playlist, mksafe(blank())])

# ── S/NC Classics: Playlist Only ──

classics = fallback(track_sensitive=false, [classics_playlist, mksafe(blank())])

# ── Metadata Tracking ──

snc_tv_uri = ref("")
snc_tv_title = ref("")
snc_tv.on_metadata(fun(m) -> begin
  snc_tv_uri := m["filename"]
  snc_tv_title := m["title"]
end)

classics_uri = ref("")
classics_title = ref("")
classics.on_metadata(fun(m) -> begin
  classics_uri := m["filename"]
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
output.url(url="rtmp://localhost:1935/live/snc-tv?key=#{playout_key}", enc, snc_tv)

# ── Output: S/NC Classics → SRS ──

output.url(url="rtmp://localhost:1935/live/channel-classics?key=#{playout_key}", enc, classics)

# ── Harbor HTTP Endpoints ──

settings.harbor.bind_addrs := ["0.0.0.0"]

# Health check
harbor.http.register(port=8888, method="GET", "/health", fun(_req, res) -> begin
  res.data("ok")
end)

# S/NC TV: now-playing (existing path — backward compatible)
harbor.http.register(port=8888, method="GET", "/now-playing", fun(_req, res) -> begin
  res.json({
    uri = snc_tv_uri(),
    title = snc_tv_title(),
    elapsed = snc_tv.elapsed(),
    remaining = snc_tv.remaining()
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
  res.json({
    uri = classics_uri(),
    title = classics_title(),
    elapsed = classics.elapsed(),
    remaining = classics.remaining()
  })
end)
