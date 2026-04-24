---
id: story-stream-auth-audit-logging
kind: story
stage: done
tags: [streaming, security]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Stream Auth Audit Logging

## Overview

Added structured audit logging for stream key authentication events in the playout auth flow.

## Change

Added `rootLogger.info` with `event: 'stream_key_accepted'` after two validation paths:

1. **Playout key match** — when the stream key matches the global playout stream key.
2. **Creator key validation** — when the stream key matches a creator's personal stream key.

Both log entries include the event type, the validated stream key (or a redacted identifier), and enough context for log-based alerting or audit queries.

## Rationale

Stream key authentication is a security-sensitive path — when a key is accepted, it grants access to push to the live broadcast. Having a structured log event at this boundary enables:

- Audit trail for who connected when
- Alerting on unexpected stream key use patterns
- Forensic investigation in case of unauthorized broadcast events

## Affected Files

- `platform/apps/api/src/routes/streaming.routes.ts` (or equivalent playout auth handler)

## Verification

Log `pm2 logs api --lines 50` and observe `event: "stream_key_accepted"` entries after starting a stream push. Confirm entries appear for both playout key and creator key paths.
