---
tags: [content, user-station]
release_binding: null
created: 2026-04-18
---

# Failed upload blocks retry

After an upload error (e.g. CORS failure), retrying the same file fails with "already exists". Stale Uppy/S3 multipart state not cleaned up on failure.

Migrated from `boards/platform/release-0.2.1/BOARD.md` Backlog lane (2026-04-18). Investigation / prod-verification bucket — needs reproduction and decision on cleanup path (client-side Uppy state clear vs. server-side stale multipart sweep).
