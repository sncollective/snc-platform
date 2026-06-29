# fire-and-forget-event-publish

Publish side-effect events inside non-failing boundaries so notification failures never break the primary mutation.

## When to use
Use when the main DB/config transition is authoritative and event/SSE delivery is advisory or recoverable.

## Instances
- `apps/api/src/services/processing-jobs.ts:98` — publishes `content.processing-status-changed`; catch at line 105 says it must never fail processing update.
- `apps/api/src/services/playout-queue-transitions.ts:80` — publishes now-playing change after `markPlayed`; catch at line 82 swallows publish failures.
- `apps/api/src/services/playout-queue-transitions.ts:181` — publishes queue change after enqueue; catch at line 183 swallows publish failures.
- `apps/api/src/services/liquidsoap-config.ts:177` — publishes `playout.engine-restarted`; catch at line 179 preserves restart result.

## Canonical sketch
```ts
await persistPrimaryTransition();
try {
  eventBus.publish({ type: "domain.event", id });
} catch {
  // fire-and-forget: publish must never fail the primary transition
}
return ok(undefined);
```

## Anti-patterns
Don't swallow failures from the primary mutation; don't use for events that are part of the transaction's correctness contract.
