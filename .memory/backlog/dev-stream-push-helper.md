---
tags: [streaming, developer-experience]
release_binding: null
created: 2026-04-20
---

# Dev stream push helper

One-line command to start a test RTMP stream against a demo creator without OBS. Useful for:

- Reviewing features that depend on a live channel being active (live-page UI, creator avatars on stream, chat presence, viewer counters, live notifications).
- Smoke-testing streaming plumbing (SRS publish callback, Liquidsoap, HLS manifest, session lifecycle) without real streaming gear.

Surfaced 2026-04-20 during `responsive-images` review: the `Unit 5h` live-page creator avatar fix needed a live channel to verify, which required creating a stream key + hand-crafting an ffmpeg push. The ffmpeg command itself is trivial; the bootstrap (find creator, create key, get raw key, compose URL) is the friction.

## Proposed shape

`scripts/platform/dev-stream-push.sh <creator-slug>`:

1. Look up the creator by slug (`handle` field) in the DB
2. Authenticate as an admin (seeded admin user / env-provided token)
3. POST to `/api/streaming/keys/:creatorId` to mint a new stream key; capture the raw key from the response
4. Spawn an ffmpeg process pushing a labeled test pattern (colorbars + timestamp + "CREATOR NAME LIVE TEST") to `rtmp://localhost:1935/live/<creator-slug>?key=<rawKey>`
5. Handle Ctrl-C: stop ffmpeg + optionally revoke the stream key

Reference ffmpeg invocation from the responsive-images review:

```bash
ffmpeg -re -f lavfi -i "testsrc2=size=1280x720:rate=30,drawtext=text='LIVE TEST %{localtime}':fontcolor=white:fontsize=48:x=20:y=20" \
       -f lavfi -i "sine=frequency=440" \
       -c:v libx264 -preset veryfast -tune zerolatency -b:v 2M -g 60 \
       -c:a aac -b:a 128k -ar 44100 \
       -f flv "rtmp://localhost:1935/live/<stream-name>?key=<rawKey>"
```

## Open questions when picked up

- Auth path: seeded admin token baked into the script, or prompt-on-run, or env var (`DEV_STREAM_ADMIN_TOKEN`)?
- Should the script revoke the key on exit (clean teardown) or leave it (re-runnable without re-auth)?
- Bundle with a "stop" command (`dev-stream-push.sh --stop <creator>`) or trust Ctrl-C?
- Optional: parallel helper for pushing a real video file instead of the test pattern (`--file path/to/video.mp4`)

## Verification when picked up

- [ ] `scripts/platform/dev-stream-push.sh maya-chen` starts a stream against Maya's live channel
- [ ] The channel appears at `/api/streaming/status` with `type: "live"` within a few seconds
- [ ] The live page renders the creator bar + the test pattern plays back
- [ ] Ctrl-C stops ffmpeg cleanly; SRS on_unpublish fires
