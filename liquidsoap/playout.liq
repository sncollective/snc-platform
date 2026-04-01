# ── Logging ──

log.stdout := true
log.file := false
log.level := 4

# ── S3 Protocol (Garage) ──

settings.protocol.aws.endpoint := environment.get("AWS_ENDPOINT", default="http://snc-garage:3900")
settings.protocol.aws.region := environment.get("AWS_DEFAULT_REGION", default="garage")

# ── Config ──

playout_key = environment.get("PLAYOUT_STREAM_KEY", default="")
srs_host = environment.get("SRS_RTMP_HOST", default="snc-srs")
api_host = environment.get("API_CALLBACK_HOST", default="snc-api")
api_port = environment.get("API_CALLBACK_PORT", default="3000")
callback_secret = environment.get("PLAYOUT_CALLBACK_SECRET", default="")

# ── Encoding ──

enc = %ffmpeg(
  format="flv",
  %video(codec="libx264", preset="ultrafast", b="2500k", g="60"),
  %audio(codec="aac", b="128k")
)

settings.harbor.bind_addrs := ["0.0.0.0"]

# ── Health Check ──

harbor.http.register(port=8888, method="GET", "/health", fun(_req, res) -> begin
  res.data("ok")
end)

# ── Channel: S/NC Classics (playout) ──
# Channel ID and srsStreamName from seed script / DB

classics_id = environment.get("CHANNEL_CLASSICS_ID", default="")
classics_stream = environment.get("CHANNEL_CLASSICS_STREAM", default="channel-classics")

classics_queue = request.queue(id="channel-#{classics_id}")
classics = fallback(track_sensitive=false, [classics_queue, mksafe(blank())])

classics_uri = ref("")
classics_title = ref("")
classics.on_metadata(synchronous=false, fun(m) -> begin
  u = m["s3_uri"]
  classics_uri := if u == "" then m["filename"] else u end
  classics_title := m["title"]
  # Webhook: notify API of track start
  ignore(process.run("curl", [
    "-s", "-X", "POST",
    "http://#{api_host}:#{api_port}/api/playout/channels/#{classics_id}/track-event?secret=#{callback_secret}",
    "-H", "Content-Type: application/json",
    "-d", '{"uri":"#{classics_uri()}","title":"#{classics_title()}"}'
  ]))
end)

output.url(url="rtmp://#{srs_host}:1935/live/#{classics_stream}?key=#{playout_key}", enc, classics)

# Harbor: per-channel endpoints
harbor.http.register(port=8888, method="POST", "/channels/#{classics_id}/queue", fun(req, res) -> begin
  classics_queue.push.uri(req.body())
  res.data("queued")
end)

harbor.http.register(port=8888, method="POST", "/channels/#{classics_id}/skip", fun(_req, res) -> begin
  classics.skip()
  res.data("skipped")
end)

harbor.http.register(port=8888, method="GET", "/channels/#{classics_id}/now-playing", fun(_req, res) -> begin
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

# ── Channel: Music Videos (playout) — add more channels by duplicating this block ──

# mv_id = environment.get("CHANNEL_MV_ID", default="")
# mv_stream = environment.get("CHANNEL_MV_STREAM", default="channel-music-videos")
# ... same pattern as classics ...

# ── S/NC TV (broadcast) ──
# Falls back to a playout channel. The default is set via env var.
# The broadcast source selector (future) will make this configurable in-app.

live_source = input.rtmp(listen=true, "rtmp://0.0.0.0:1936/live/stream")
snc_tv_queue = request.queue(id="snc-tv-queue")

default_playout_stream = environment.get("DEFAULT_PLAYOUT_STREAM", default="channel-classics")

# S/NC TV fallback: live > queue > default playout channel > silence
# The default playout channel is referenced directly (classics in the default config)
snc_tv = fallback(track_sensitive=false, [live_source, snc_tv_queue, classics, mksafe(blank())])

snc_tv_uri = ref("")
snc_tv_title = ref("")
snc_tv.on_metadata(synchronous=false, fun(m) -> begin
  u = m["s3_uri"]
  snc_tv_uri := if u == "" then m["filename"] else u end
  snc_tv_title := m["title"]
end)

snc_tv_stream = environment.get("CHANNEL_SNCTV_STREAM", default="snc-tv")
output.url(url="rtmp://#{srs_host}:1935/live/#{snc_tv_stream}?key=#{playout_key}", enc, snc_tv)

# S/NC TV harbor (backward compatible paths + channel-aware paths)
harbor.http.register(port=8888, method="GET", "/now-playing", fun(_req, res) -> begin
  e = snc_tv.elapsed()
  r = snc_tv.remaining()
  safe_elapsed = if e == infinity or e != e then -1. else e end
  safe_remaining = if r == infinity or r != r then -1. else r end
  res.json({
    uri = snc_tv_uri(),
    title = snc_tv_title(),
    elapsed = safe_elapsed,
    remaining = safe_remaining
  })
end)
