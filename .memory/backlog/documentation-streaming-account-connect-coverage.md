---
tags: [documentation, streaming]
release_binding: null
created: 2026-04-21
---

# Streaming Account Connect — Docs Coverage Check

Check that `platform/docs/streaming.md` covers the Twitch/YouTube OAuth connect flow: separate scopes from social login (`channel:read:stream_key`, `youtube.force-ssl`), auto-created inactive simulcast destinations, and the required `YOUTUBE_CLIENT_ID` env var.

Relevant files: `apps/api/src/services/streaming-connect.ts`, `apps/api/src/routes/streaming-connect.routes.ts`.

Forwarded from feature/release-0.2.2 (2026-04-11). Target audience: developers reviewing agent work or contributing manually.
