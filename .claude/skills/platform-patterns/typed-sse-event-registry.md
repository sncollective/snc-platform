# typed-sse-event-registry

Define event payloads as a shared discriminated union, route every event through an exhaustive API registry carrying topic, coalescing key, optional scope filter.

## When to use
SSE spine needs typed payloads, access-controlled topics, burst coalescing, creator/member scoping without scattering per-event routing.

## Instances
- `packages/shared/src/events.ts:6,13,30,46` + `apps/api/src/services/event-bus.ts:73,79,96,102,108,116` — schema→topic/coalesce/scope mappings.
- `apps/api/src/routes/sse.routes.ts:51,179` — route computes granted topics, subscribes via bus.

## Anti-patterns
Don't publish untyped ad hoc events; don't duplicate event→topic routing in every publisher; don't use unbounded per-subscriber queues when latest-state coalescing suffices.
