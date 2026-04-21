---
tags: [testing, streaming, community]
release_binding: null
created: 2026-04-20
---

# Testing: go-live notification dispatch e2e coverage

Verify e2e coverage for the go-live notification flow: the `on_publish` SRS callback fires `dispatchNotification` for the `go_live` event, a pg-boss job is enqueued, the audience is resolved (followers + subscribers, deduped), and jobs are recorded in the `notification_jobs` table.

Relevant files: `apps/api/src/routes/streaming.routes.ts`, `apps/api/src/services/notification-dispatch.ts`, `apps/api/src/jobs/handlers/notification-send.ts`.

Forwarded from feature/release-0.2.2 (2026-04-11).
