---
id: gate-security-signup-audit-log-raw-email
kind: story
stage: backlog
tags: [security]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: security
created: 2026-06-29
updated: 2026-06-29
---

# Signup audit log includes raw user email addresses

## Severity
Low

## Domain
Data Protection

## Location
`apps/api/src/auth/auth.ts:117`

## Evidence
```ts
rootLogger.info(
  {
    event: "user_signup",
    userId: user.id,
    email: user.email,
```

## Remediation direction
Log user id and event metadata only, or hash/redact email addresses in production logs.
