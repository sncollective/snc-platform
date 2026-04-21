---
tags: [streaming, deploy]
release_binding: null
created: 2026-04-21
---

# Liquidsoap Harbor HTTP Port Not Browser-Accessible in Dev

Liquidsoap harbor HTTP port 8888 is not accessible from the browser in the dev environment — connection returns -102 errors. Needs either port forwarding in the dev container config or a Caddy proxy entry to expose the harbor endpoint. Affects any browser-initiated calls to the harbor controls (e.g., manual queue reload, now-playing metadata endpoint).
