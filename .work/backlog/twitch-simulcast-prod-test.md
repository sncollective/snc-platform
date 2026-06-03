---
tags: [streaming, user-station]
release_binding: null
created: 2026-04-18
---

# Twitch simulcast prod test

Deploy `restartPlayoutForward()` fix and verify: add a Twitch destination while playout is running, confirm stream appears on Twitch. If still stuck on "determining quality", check keyframe interval (`g=60` needs `r=30` for 2s keyframes) and test direct ffmpeg push.
