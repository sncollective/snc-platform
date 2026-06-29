---
id: gate-security-rtmp-callback-payload-leak
kind: story
stage: review
tags: [security]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: security
created: 2026-06-29
updated: 2026-06-29
---

# Raw RTMP stream-key callback payload is forwarded after key extraction

## Severity
High

## Domain
Secrets & Configuration

## Location
`apps/api/src/routes/streaming.routes.ts:250`

## Evidence
```ts
const rawKey = extractStreamKey(body.param);
// ...
srsStreamName: body.stream,
callbackPayload: body as unknown as Record<string, unknown>,
```

## Remediation direction
Redact or drop `param` before passing callback payloads to session/event storage or logging; retain only non-secret metadata plus the stream key id/hash.

## Implementation (2026-06-29)
- Files changed: `apps/api/src/routes/streaming.routes.ts`, `apps/api/tests/routes/streaming.routes.test.ts`.
- Added an allowlist-based SRS callback payload redactor for persisted session/event payloads. `param` is no longer forwarded to `openSession` or `closeSession`; only non-secret SRS metadata (`action`, `client_id`, `ip`, `vhost`, `app`, `stream`, `stream_id`) is retained.
- The validated stream key still derives the stored `streamKeyId`; no raw stream key or raw RTMP param is persisted in callback payloads.
- Tests added/updated: on-publish and on-unpublish route assertions that persisted callback payloads omit `param`.
- Verification: `bun run --filter @snc/api test:unit -- tests/routes/streaming.routes.test.ts`; `bun run --filter @snc/api test:unit`.
- Discrepancies from design: none.
- Adjacent issues parked: none.
