---
id: gate-security-simulcast-destination-ssrf
kind: story
stage: drafting
tags: [security]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: security
created: 2026-06-29
updated: 2026-06-29
---

# Creator simulcast accepts arbitrary RTMP(S) destinations for server-side forwarding

## Severity
Medium

## Domain
Input Validation & Injection

## Location
`packages/shared/src/simulcast.ts:59`

## Evidence
```ts
export const RTMP_URL_REGEX = /^rtmps?:\/\/.+/;
// ...
rtmpUrl: z.string().url().regex(RTMP_URL_REGEX, "Must be an rtmp:// or rtmps:// URL"),
```

## Remediation direction
Add server-side destination policy: block private/link-local/internal host ranges, restrict ports, prefer platform allowlists for built-ins, and log/review custom destinations.
