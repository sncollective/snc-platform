---
id: gate2-docs-harbor-secret-unguarded
kind: story
stage: review
tags: [documentation]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: docs
created: 2026-06-29
updated: 2026-06-29
---

# Liquidsoap Harbor queue/skip docs still show unguarded endpoints

## Severity
High (foundation-doc drift)

## Location
`docs/streaming.md:133-134`; contradicts `apps/api/src/services/liquidsoap-render.ts:356-371` (now secret-gated)

## Evidence
Docs list POST /channels/{channelId}/queue and /skip without ?secret=. Code now rejects unless q["secret"]==secret.

## Remediation direction
Update the Harbor table + queue/skip/arm prose to show ?secret=-guarded mutating endpoints requiring PLAYOUT_CALLBACK_SECRET.

## Implementation (2026-06-29)
- Updated `docs/streaming.md` Harbor API table so queue and skip show `?secret=...`, matching arm.
- Updated Harbor wrapper and skip/queue prose to state queue, skip, and arm are secret-guarded mutating endpoints requiring `PLAYOUT_CALLBACK_SECRET`.
- Verification not run per operator instruction (`bun` unavailable in this sub-agent harness).
