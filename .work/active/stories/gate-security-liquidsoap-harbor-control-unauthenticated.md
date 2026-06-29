---
id: gate-security-liquidsoap-harbor-control-unauthenticated
kind: story
stage: implementing
tags: [security]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: security
created: 2026-06-29
updated: 2026-06-29
---

# Liquidsoap queue/skip control endpoints are generated without authentication

## Severity
High

## Domain
Infrastructure & Deployment

## Location
`apps/api/src/services/liquidsoap-render.ts:356`

## Evidence
```ts
harbor.http.register(port=${t.harborPort}, method="POST", "${ch.harborPaths.queue}", fun(req, res) -> begin
  ${queueWebhookVarName ?? `${vid}_queue`}.push.uri(req.body())
  res.data("queued")
end)
```

## Remediation direction
Require the existing callback secret or an internal mTLS/header guard on queue/skip endpoints, and avoid binding the harbor control plane beyond the trusted container network.
