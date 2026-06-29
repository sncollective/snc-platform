---
id: gate-tests-sse-session-expiry-close
kind: story
stage: implementing
tags: [testing]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: tests
created: 2026-06-29
updated: 2026-06-29
---

# SSE session-expiry close path is not covered

## Priority
Critical

## Spec reference
Item: `bold-event-spine-sse-endpoint-route`
Acceptance criterion: "Heartbeat after quiet interval; close past deadline and past session expiry; cap → 503 (all with DI'd values)."

## Gap type
missing test for boundary / state transition

## Suggested test
```ts
it("closes the stream at session expiry before the DI lifetime deadline", async () => {
  const soonExpiringSession = makeMockSession({
    expiresAt: new Date(Date.now() + 50).toISOString(),
  });

  const { app, mockSub } = await buildTestApp({
    session: soonExpiringSession,
    sub: makeMockSub([]),
  });

  const res = await app.request("/api/sse?topics=live");
  const body = await res.text();

  expect(body).toContain("event: spine.connected");
  expect(mockSub.close).toHaveBeenCalled();
  // Assert it did not run until the longer lifetimeMs deadline.
});
```

## Test location (suggested)
`apps/api/tests/routes/sse.routes.test.ts`
