---
id: gate2-tests-simulcast-update-rejection
kind: story
stage: implementing
tags: [testing]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: tests
created: 2026-06-29
updated: 2026-06-29
---

# Simulcast SSRF/domain policy lacks update-path rejection coverage

## Priority
High

## Spec reference
Item: `gate-security-simulcast-destination-ssrf`
Acceptance criterion: block private/link-local/internal on updates, not just creates.

## Suggested test
`apps/api/tests/services/simulcast.test.ts` + `packages/shared/tests/simulcast.test.ts` — PATCH existing twitch dest to private/non-twitch RTMP → 400, no DB update.
