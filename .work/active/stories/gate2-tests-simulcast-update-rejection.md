---
id: gate2-tests-simulcast-update-rejection
kind: story
stage: done
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

## Implementation (2026-06-29)
- Added shared update-schema coverage rejecting private/internal RTMP update targets and built-in platform domain mismatches.
- Added admin and creator simulcast PATCH route coverage for private RTMP updates returning 400 before the update service is called, proving no DB update path is reached.
- Verification not run per operator instruction (`bun` unavailable in this sub-agent harness).

## Review (2026-06-29)

**Verdict**: Approve. Fast-lane (gate-rerun-1 finding, green verification — full suite: shared + api 116 + web build/test). No blockers above nit.
