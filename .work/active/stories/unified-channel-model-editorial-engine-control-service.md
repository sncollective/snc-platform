---
id: unified-channel-model-editorial-engine-control-service
kind: story
stage: implementing
tags: [streaming, playout]
parent: unified-channel-model-editorial-engine
depends_on: [unified-channel-model-editorial-engine-control-client, unified-channel-model-editorial-engine-config-schema]
release_binding: null
gate_origin: null
created: 2026-06-16
updated: 2026-06-16
---

# Editorial control service + routes + restart wiring

Implements **Unit 5** of `unified-channel-model-editorial-engine` (full design in the feature body).
Makes the engine controllable — the verbs the editorial UI (out of scope here) will consume.

## Scope
- `apps/api/src/services/editorial-control.ts` (new): live verbs (mode / priority / arm-take) **persist to
  DB and live-mutate** via the client (durable + immediate; restart-agnostic). **Structural** edits (tier
  add/remove, carry-edge add/remove, channel CRUD) persist then trigger the **existing
  regenerate-and-restart** path (re-render `.liq` + restart — the path already invoked on channel
  create/delete). Validates against config + role/ownership. Returns `Result<…, AppError>`.
- `apps/api/src/routes/playout.routes.ts`: thin role-scoped handlers delegating to the service.

## Acceptance criteria
- [ ] Each route has happy-path + auth-failure tests (AGENTS testing convention).
- [ ] Live verbs persist to DB AND call the client; a restart restores state from persisted config.
- [ ] A structural edit triggers regenerate-and-restart; a live verb does not.
- [ ] The two workshop scenarios are expressible without a playout reset: "build a queue while the pool
      rotates, switch over when ready" (arm/take) and "choose the scheduled event over the live creator"
      (priority pin / manual).
- [ ] Live-mutate round-trip against a real pipeline noted as an integration/staging check (no container
      in unit).
