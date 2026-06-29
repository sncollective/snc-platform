---
id: gate-security-rtmp-callback-payload-leak
kind: story
stage: implementing
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
