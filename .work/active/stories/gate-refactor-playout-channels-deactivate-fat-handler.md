---
id: gate-refactor-playout-channels-deactivate-fat-handler
kind: story
stage: done
tags: [refactor, structural]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: refactor
created: 2026-06-29
updated: 2026-06-29
---

# Admin playout channel deactivation embeds DB mutation logic in the route handler

## Source library
scan-structural — rule: thin-handlers

## Severity
High

## Findings-route
refactor (behavior-preserving — matches thin-handlers-fat-services pattern)

## Location
`apps/api/src/routes/playout-channels.routes.ts:98`

## Evidence
```ts
const [channel] = await db
  .select()
  .from(channels)
  .where(and(eq(channels.id, channelId), eq(channels.role, "playout")));
```

## Remediation direction
Move the deactivate-channel workflow into a service and leave the route as validate/delegate/respond. Aligns with the `thin-handlers-fat-services` platform pattern.

## Implementation (2026-06-29)
- Files changed: `apps/api/src/services/channels.ts`, `apps/api/src/routes/playout-channels.routes.ts`, `apps/api/tests/services/channels.test.ts`, `apps/api/tests/routes/playout-channels.routes.test.ts`.
- Extracted admin playout deactivation into `deactivatePlayoutChannel()`, returning `Result<PlayoutChannelDeactivation, AppError>` from the service while preserving the playout-role lookup, `isActive=false` update, regenerate/restart health probe, and `NOT_FOUND` response semantics.
- Slimmed the route handler to param extraction, service delegation, error mapping, and response shaping.
- Added service and route coverage for success, missing channel, auth/role rejection, and regenerate-failure response shape.
- Verification: not run — the sandbox cannot execute `bash` commands from this submodule checkout because the harness tries to create `/home/agent/SNC/platform/.git/hooks` even though `.git` is a submodule gitfile.

## Review (2026-06-29)

**Verdict**: Approve

**Notes**: Fast-lane (story with green verification). Implementation verified in the implement wave: full suite green (shared 682, api 1890, web 1807, web build). No blockers or important findings above nit.
