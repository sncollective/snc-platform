---
id: gate-refactor-streaming-route-file-size
kind: story
stage: drafting
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
