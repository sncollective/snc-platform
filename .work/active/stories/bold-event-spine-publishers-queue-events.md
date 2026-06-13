---
id: bold-event-spine-publishers-queue-events
kind: story
stage: implementing
tags: [streaming, playout]
release_binding: null
depends_on: [bold-event-spine-publishers-input-switch]
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: bold-event-spine-publishers
---

# Queue + engine publishers

Unit 2 of the parent feature design.

## Scope

- Shared union additions: `playout.queue-changed {channelId}`,
  `playout.now-playing-changed {channelId}`, `playout.engine-restarted {}`.
- Registry entries (topic `playout`; coalesce by channelId / channelId / static
  `"engine"`).
- Publishes inside the transitions module (`markPlayed` + `promoteNext` →
  now-playing-changed; `enqueue` + `enqueueBatch` (count > 0) + `removeQueued` success
  → queue-changed) — the module is the named side-effect attachment point; do NOT
  publish from orchestrator call sites.
- `regenerateAndRestart` success → engine-restarted.

## Acceptance criteria

- [ ] Transition unit tests assert publishes (spy bus); existing assertions unweakened;
      orchestrator suite green unchanged.
- [ ] Exhaustive-registry compile check holds (new union members force entries).
- [ ] Fire-and-forget: a throwing bus (forced in test) does not fail a transition.
