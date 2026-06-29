---
id: gate-tests-event-schema-parsing-rejection
kind: story
stage: review
tags: [testing]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: tests
created: 2026-06-29
updated: 2026-06-29
---

# Shared event schema does not test proof-event parsing or unknown-type rejection

## Priority
Critical

## Spec reference
Item: `bold-event-spine-sse-endpoint-types-bus`
Acceptance criterion: "`PlatformEventSchema` parses the proof event; unknown `type` rejects."

## Gap type
missing test for valid partition / error case

## Suggested test
```ts
it("parses channel.live-state-changed and rejects unknown event types", () => {
  expect(PlatformEventSchema.safeParse({
    type: "channel.live-state-changed",
    channelId: "ch-1",
    live: true,
  }).success).toBe(true);

  expect(PlatformEventSchema.safeParse({
    type: "unknown.event",
  }).success).toBe(false);
});
```

## Test location (suggested)
`packages/shared/tests/events.test.ts`

## Implementation (2026-06-29)
- Files changed: `packages/shared/tests/events.test.ts`
- Tests added: `PlatformEventSchema` parses every documented platform event variant and rejects an unknown `type`.
- Verification: `bun run --filter @snc/shared test` passed (20 files, 682 tests).
- Discrepancies from design: expanded beyond the proof event to cover all documented event variants in the union.
- Adjacent issues parked: none.
