---
tags: [testing, streaming]
release_binding: null
created: 2026-04-20
---

# Testing: streaming account connect e2e coverage

Verify golden-path e2e coverage for Twitch/YouTube OAuth connect buttons on the streaming manage page: connect buttons are visible, OAuth redirect flow initiates, auto-created inactive simulcast destinations appear after connect, and success/error query param feedback renders correctly.

Relevant files: `apps/api/src/routes/streaming-connect.routes.ts`, `apps/api/src/services/streaming-connect.ts`, `apps/web/src/routes/creators/$creatorId/manage/streaming.tsx`.

Forwarded from feature/release-0.2.2 (2026-04-11).
