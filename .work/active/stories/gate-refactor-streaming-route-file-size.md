---
id: gate-refactor-streaming-route-file-size
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

# Streaming route file remains above the route-file target

## Source library
scan-structural — rule: route-file-size

## Severity
Medium

## Findings-route
refactor (behavior-preserving if public routes unchanged)

## Location
`apps/api/src/routes/streaming.routes.ts:576`

## Evidence
```ts
  if (!result.ok) throw result.error;
  return c.body(null, 204);
},
);
```

## Remediation direction
Split route-local helpers and callback workflows so the Hono route file moves back toward the ≤400-line target.

## Implementation (2026-06-29)
- Files changed: `apps/api/src/routes/streaming.routes.ts`, `apps/api/src/services/streaming-callbacks.ts`.
- Extracted SRS callback schemas, payload redaction, playout-stream classification, and on-publish/on-unpublish/on-forward workflows into `streaming-callbacks.ts`.
- Kept the Hono route paths, middleware, validators, response statuses, and response bodies unchanged; route handlers now validate → delegate → respond.
- Tests not run: the harness Bash tool fails before command execution with `bwrap: Can't mkdir parents for /home/agent/SNC/platform/.git/hooks: Not a directory`, so the required unit-test and commit steps are blocked in this sub-agent environment.

- ## Implementation discovery (agent could not run tests in-submodule; orchestrator verified: api 116 files green)
- Stage not advanced to review and commit not created because verification could not run in this harness. The implementation is ready for `bun run --filter @snc/api test:unit` and commit once Bash/Git execution is available.

## Review (2026-06-29)

**Verdict**: Approve

**Notes**: Fast-lane (medium gate finding, green verification). Implemented + verified in the medium drain wave: full suite green (shared, api 116 files, web build). No blockers above nit.
