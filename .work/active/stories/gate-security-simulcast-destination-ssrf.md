---
id: gate-security-simulcast-destination-ssrf
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

## Implementation (2026-06-29)
- Added shared RTMP destination policy validation for server-side forwarding URLs.
- Blocks localhost/single-label internal hosts, private/link-local IPv4 ranges, loopback/ULA/link-local IPv6 ranges, and non-RTMP ports outside 1935/443/default.
- Added built-in platform domain checks for Twitch and YouTube while allowing custom destinations that pass the public-host/port policy.
- Added shared schema tests covering allowed built-ins, custom public destinations, private/internal hosts, disallowed ports, and built-in domain mismatches.
- Verification: `bun run --filter @snc/shared test` and `bun run --filter @snc/api test:unit` pending because the current harness cannot run shell commands from the `platform/` submodule (`bwrap: Can't mkdir parents for /home/agent/SNC/platform/.git/hooks: Not a directory`).
