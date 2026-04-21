---
tags: [community]
release_binding: null
created: 2026-04-20
---

# Notification Digest Mode

Allow users to opt into batched notification delivery (daily or weekly summaries) instead of immediate per-event emails. Requires extending the notification preferences schema to capture delivery cadence per event type or globally, and a digest job that aggregates pending notifications and dispatches a single summary email on the configured schedule.
