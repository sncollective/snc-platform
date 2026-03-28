# ── Logging ──

log.stdout := true
log.file := false

# ── S3 Protocol (Garage) ──
# Liquidsoap's s3:// protocol shells out to AWS CLI.
# Endpoint configured here; credentials via AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars.

settings.protocol.aws.endpoint := "http://localhost:3900"
settings.protocol.aws.region := "garage"

# ── Playlist Source ──
# Reads M3U playlist with s3:// URIs pointing to Garage.
# Liquidsoap downloads each file via `aws s3 cp` before playback.

playlist_source = playlist("/workspaces/SNC/platform/liquidsoap/playlist.m3u", mode="normal", reload_mode="watch", reload=10)

# ── Live Input ──
# RTMP server on port 1936. Creators push here to go live.
# Path: rtmp://localhost:1936/live/stream

live_source = input.rtmp(listen=true, "rtmp://0.0.0.0:1936/live/stream")

# ── Admin Queue ──
# Items pushed here play next, before playlist resumes.

queue_source = request.queue(id="admin-queue")

# ── Fallback: Live > Queue > Playlist ──
# track_sensitive=false: switch immediately, don't wait for track boundaries.

# mksafe() guarantees an infallible source — produces silence/blank when all sources fail.
# Without it, Liquidsoap refuses to start if both live and playlist are unavailable.
radio = fallback(track_sensitive=false, [live_source, queue_source, playlist_source, mksafe(blank())])

# ── Now-Playing Metadata Tracking ──

current_uri = ref("")
current_title = ref("")

radio.on_metadata(fun(m) -> begin
  current_uri := m["filename"]
  current_title := m["title"]
end)

# ── Output: RTMP Push to SRS ──
# Encode to H.264+AAC. Copy passthrough won't work because the fallback chain
# includes mksafe(blank()) which produces internal-format tracks, not FFmpeg copy tracks.
# ultrafast preset keeps CPU usage low for the spike.

enc = %ffmpeg(
  format="flv",
  %video(codec="libx264", preset="ultrafast", b="2500k", g="60"),
  %audio(codec="aac", b="128k")
)

# Read playout key from environment for SRS callback authentication
playout_key = environment.get("PLAYOUT_STREAM_KEY", default="")
output.url(url="rtmp://localhost:1935/live/channel-main?key=#{playout_key}", enc, radio)

# ── Harbor HTTP Endpoints ──

settings.harbor.bind_addrs := ["0.0.0.0"]

# Health check
harbor.http.register(port=8888, method="GET", "/health", fun(_req, res) -> begin
  res.data("ok")
end)

# Now-playing metadata
harbor.http.register(port=8888, method="GET", "/now-playing", fun(_req, res) -> begin
  res.json({
    uri = current_uri(),
    title = current_title(),
    elapsed = radio.elapsed(),
    remaining = radio.remaining()
  })
end)

# Skip current track
harbor.http.register(port=8888, method="POST", "/skip", fun(_req, res) -> begin
  radio.skip()
  res.data("skipped")
end)

# Queue a track to play next
harbor.http.register(port=8888, method="POST", "/queue", fun(req, res) -> begin
  queue_source.push.uri(req.body())
  res.data("queued")
end)
