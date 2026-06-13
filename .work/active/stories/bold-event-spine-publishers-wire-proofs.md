---
id: bold-event-spine-publishers-wire-proofs
kind: story
stage: implementing
tags: [streaming, playout]
release_binding: null
depends_on: [bold-event-spine-publishers-content-events]
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: bold-event-spine-publishers
---

# Wire proofs — composition test + e2e carry-overs

Unit 4 of the parent feature design. Discharges the two residues carried from the
sse-endpoint review.

## Scope

- Route test composing REAL `createEventBus()` into `createSseRoutes({bus})`: connect,
  publish, assert the typed frame on the HTTP response stream.
- Dev-wire proof A: extend `apps/api/scripts/sse-smoke.ts` (`--expect-event` mode);
  POST the input-switch webhook (with secret) while an SSE client holds `?topics=live`
  through Caddy `:3080`; assert the live-state frame arrives.
- Dev-wire proof B: drive a real stream start/stop (`scripts/dev/test-live-fallback.sh`
  or ffmpeg) and observe the on_publish-sourced event. If RTMP can't be driven
  in-session, document honestly — proof A already covers the composed wire path.

## Acceptance criteria

- [ ] Real-bus composition route test green.
- [ ] Webhook→bus→SSE frame observed through Caddy (script output in notes).
- [ ] SRS-path e2e observed OR honestly documented as residual with proof-A coverage
      noted.
