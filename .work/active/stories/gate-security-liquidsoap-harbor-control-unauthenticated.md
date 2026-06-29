---
id: gate-security-liquidsoap-harbor-control-unauthenticated
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

## Implementation (2026-06-29)
- Files changed: `apps/api/src/services/liquidsoap-render.ts`, `apps/api/src/services/liquidsoap-client.ts`, Liquidsoap client/render tests, and generated `.liq` snapshots.
- Queue and skip harbor handlers now require `?secret=` to match `PLAYOUT_CALLBACK_SECRET` and return 401 without mutating state when missing or wrong.
- API-originated `pushTrack` and `skipTrack` calls now use the same guarded client path as `armQueue`, failing fast with `LIQUIDSOAP_SECRET_NOT_CONFIGURED` when the callback secret is absent.
- Tests added/updated: guarded queue/skip render regression, client request URL/secret regressions, snapshot updates.
- Verification: `bun run --filter @snc/api test:unit -- tests/services/liquidsoap-client.test.ts tests/services/playout-topology.test.ts`; `bun run --filter @snc/api test:unit`.
- Discrepancies from design: none.
- Adjacent issues parked: none.
