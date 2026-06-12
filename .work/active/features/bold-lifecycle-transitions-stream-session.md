---
id: bold-lifecycle-transitions-stream-session
kind: feature
stage: drafting
tags: [refactor, streaming]
release_binding: null
depends_on: [refactor-streaming-lifecycle-service-extraction]
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: bold-lifecycle-transitions
---

# Stream session transitions: single writer for open/close

## Brief
Make session state explicit: today "open" is `endedAt == null` with no validation that
`endedAt > startedAt` and no single owner of the write. Consolidate open/close into named
transitions in the session/lifecycle service layer
(`apps/api/src/services/stream-sessions.ts`), invoked from the SRS on_publish /
on_unpublish callback path — and from nowhere else.

Depends on `refactor-streaming-lifecycle-service-extraction` (in-flight): that story
extracts `ensureLiveChannelWithChat` / `teardownLiveChannel` out of
`streaming.routes.ts` into a `stream-lifecycle.ts` service — the natural home for these
transitions. Let it land first and build on its module layout.

Behavior-preserving: same `startedAt`/`endedAt` writes; the derived "is live" semantics
are unchanged.
