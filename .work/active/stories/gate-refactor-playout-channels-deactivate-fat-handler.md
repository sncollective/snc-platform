---
id: gate-refactor-playout-channels-deactivate-fat-handler
kind: story
stage: implementing
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
