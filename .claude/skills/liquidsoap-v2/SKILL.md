---
name: liquidsoap-v2
description: >
  Liquidsoap v2.4 streaming language reference. Auto-loads when working with
  Liquidsoap, playout, playlist, fallback, output.url, input.rtmp, harbor,
  RTMP push, live streaming automation, playout.liq, annotate, metadata,
  on_metadata, s3 protocol, request.queue.
user-invocable: false
updated: 2026-04-13
---

# Liquidsoap v2.4 Reference

> **Version:** 2.4.x
> **Docs:** https://liquidsoap.readthedocs.io/en/latest/

See [reference.md](reference.md) for the full API reference (sources, outputs, operators, settings, scripting).

## Key Gotchas

### Settings Use `:=` Not `set()`

v2.4 uses the `:=` operator for settings. The old `set("key", value)` syntax is from v1.x and no longer correct:

```liquidsoap
# Correct (v2.4)
log.stdout := true
log.level := 4

# Wrong (v1.x syntax)
set("log.stdout", true)
```

### `output.url` Requires FFmpeg Encoder

There is no `output.rtmp()` function. Use `output.url()` with an FFmpeg encoder configured for FLV format:

```liquidsoap
# Correct — FLV format for RTMP
output.url(url="rtmp://srs:1935/live/stream", %ffmpeg(format="flv", %audio.copy, %video.copy), source)

# Wrong — no such function
output.rtmp(url="rtmp://srs:1935/live/stream", source)
```

### `input.rtmp` Port Is in the URL

Port is specified inside the URL string, not as a separate parameter:

```liquidsoap
# Correct
live = input.rtmp(listen=true, "rtmp://0.0.0.0:1936/live/stream")

# Wrong — no port parameter
live = input.rtmp(listen=true, port=1936)
```

### `fallback()` Is Track-Sensitive by Default

With `track_sensitive=true` (default), fallback waits for the current track to end before switching. For live streaming, you almost always want instant switching:

```liquidsoap
# Instant switching (live streaming)
radio = fallback(track_sensitive=false, [live, playlist_source])

# Waits for track end (radio-style)
radio = fallback(track_sensitive=true, [live, playlist_source])
```

### Fallible Sources Need Handling

`input.rtmp(listen=true, ...)` returns a fallible source (unavailable when no one is streaming). If used as the only source for an output, Liquidsoap will refuse to start. Wrap in `fallback()` or `mksafe()`:

```liquidsoap
# Good — fallback to playlist when live is unavailable
radio = fallback(track_sensitive=false, [live, playlist_source])

# Good — silence when unavailable
safe_live = mksafe(live)

# Bad — Liquidsoap refuses to start (fallible source on infallible output)
output.url(url="rtmp://...", encoder, live)
```

### `playlist()` Pre-Downloads Remote Files

`playlist()` with HTTP/HTTPS URLs downloads entire files to a temp directory before playback. This is fine for short clips but can cause delays for large files. For truly streaming remote sources, use `input.http()` instead.

### Callbacks Changed in v2.4

Callbacks are now methods on sources/outputs, not constructor parameters. **All callbacks require an explicit `synchronous` parameter** — omitting it causes `Error 15: Missing arguments in function application: synchronous : bool`:

```liquidsoap
# v2.4 — callback as method with required synchronous parameter
o = output.url(url="rtmp://...", encoder, source)
o.on_connect(synchronous=true, fun () -> log("Connected"))

# on_metadata also requires synchronous
radio.on_metadata(synchronous=false, fun(m) -> begin
  log("Now playing: #{m["filename"]}")
end)

# Wrong — missing synchronous (Error 15)
radio.on_metadata(fun(m) -> begin ... end)

# Wrong (v2.3 syntax) — callback as parameter
output.url(url="rtmp://...", encoder, on_connect=fun () -> ..., source)
```

Use `synchronous=false` for metadata tracking (non-blocking). Use `synchronous=true` when the callback must complete before playback continues.

### Harbor HTTP Handler Takes Two Arguments

`harbor.http.register` handler receives `(request, response)` — not a single request object:

```liquidsoap
# Correct — two args: request record + response helper
harbor.http.register(port=8888, method="GET", "/health", fun(_req, res) -> begin
  res.data("ok")
end)

# Wrong — single arg (type error: expected (_ , _, ...) -> _)
harbor.http.register(port=8888, method="GET", "/health", fun(req) -> begin
  http.response(status_code=200, data="ok")
end)
```

The response helper has methods: `res.data(string)`, `res.json(value)`, `res.html(string)`, `res.redirect(url)`, `res.header(name, value)`, `res.content_type(string)`, `res.http_version(string)`.

### `process.run` Takes a Single Command String, Not Binary + Args

`process.run` accepts **one unlabeled string** — the entire shell command. There is no separate args list or `args=` label. Passing a list as a second argument fails because the function only takes one unlabeled parameter:

```liquidsoap
# Wrong — list is a second unlabeled argument (Error 6: no more unlabeled argument)
process.run("curl", ["-s", "-X", "POST", url])

# Wrong — no such labeled parameter (Error 6: no argument labeled "args")
process.run("curl", args=["-s", "-X", "POST", url])

# Correct — entire command as one string
process.run("curl -s -X POST #{url}")
```

For HTTP requests, prefer native `http.post` / `http.get` — no shell escaping, no external dependency:

```liquidsoap
# Best — native HTTP
ignore(http.post(
  headers=[("Content-Type", "application/json")],
  data='{"uri":"#{uri()}","title":"#{title()}"}',
  "http://api:3000/webhook"
))
```

### Non-AV Streams Hang the FFmpeg Decoder

Liquidsoap's FFmpeg decoder hangs indefinitely on files containing data streams (timecode, camera telemetry like Sony `rtmd`, GoPro `gpmd`, chapter markers, etc.). The request resolution blocks silently — no error, no timeout. The playlist source never becomes ready and the fallback chain stays on silence.

**Always strip non-AV streams before files reach Liquidsoap.** Use `-map 0:v:0 -map 0:a:0` in any FFmpeg remux or transcode step. This is a codec-copy operation — fast regardless of file size. Confirmed on both v2.3.2 and v2.4.2.

## Anti-Patterns

1. **Don't use `set()` for settings** — use `:=` operator. `set()` is v1.x syntax.

2. **Don't forget `format="flv"` for RTMP output** — RTMP requires FLV container format. Without it, the stream will fail.

3. **Don't use `track_sensitive=true` for live fallback** — the default waits for track boundaries, causing delayed switching. Always use `track_sensitive=false` for live-over-playlist.

4. **Don't expose telnet to the network** — telnet server has NO authentication. Keep it on localhost, use harbor HTTP for external control.

5. **Don't use `%audio.copy` with sources that need transcoding** — copy passthrough only works when the source codec matches the output requirement. If source is Opus but output needs AAC, you must specify the codec explicitly.

6. **Don't forget `mksafe()` or `fallback()`** — unhandled fallible sources prevent Liquidsoap from starting. Every `input.rtmp` and `input.http` is fallible.

7. **Don't use `process.run` for HTTP requests** — `process.run` takes a single shell command string (not separate binary + args), requiring manual escaping for interpolated values. Use native `http.post` / `http.get` instead — type-safe, no escaping, no external dependency.

## Resources

- [Liquidsoap Documentation](https://liquidsoap.readthedocs.io/en/latest/)
- [Liquidsoap Language Reference](https://www.liquidsoap.info/doc-dev/language.html)
- [Liquidsoap FFmpeg Encoder](https://www.liquidsoap.info/doc-dev/ffmpeg.html)
- [Radio France rf-liquidsoap](https://github.com/radiofrance/rf-liquidsoap)
- [Liquidsoap GitHub](https://github.com/savonet/liquidsoap)
