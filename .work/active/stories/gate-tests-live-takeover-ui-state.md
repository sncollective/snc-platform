---
id: gate-tests-live-takeover-ui-state
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

# Live-page SSE test does not assert the takeover UI state actually flips

## Priority
Critical

## Spec reference
Item: `live-experience-redesign-live-state-live-wiring`
Acceptance criterion: "Takeover transition flips the indicator without a page reload"

## Gap type
e2e-seam

## Suggested test
```tsx
it("updates the LIVE indicator from the refetched status after a spine event", async () => {
  mockUseLoaderData.mockReturnValue({ initial: makeChannelList() });
  mockApiGet.mockResolvedValueOnce({
    channels: [makeChannel(liveOverrides({ id: "channel-1" }))],
    defaultChannelId: "channel-1",
  });

  render(<LivePage />);
  act(() => FakeEventSource.instances.at(-1)!.emitConnected(["live"]));
  act(() => FakeEventSource.instances.at(-1)!.emitEvent("channel.live-state-changed", {
    channelId: "channel-1",
    live: true,
  }));

  expect(await screen.findByText("LIVE")).toBeInTheDocument();
});
```

## Test location (suggested)
`apps/web/tests/unit/routes/live.test.tsx`

## Implementation (2026-06-29)
- Files changed: `apps/web/tests/unit/routes/live.test.tsx`.
- Tests added: live route SSE coverage proving a `channel.live-state-changed` event refetches status and flips the same-page status bar from offline to `LIVE`.
- Verification: `bun run --filter @snc/web test -- tests/unit/routes/live.test.tsx` passed.
- Discrepancies from design: added an explicit reconnect re-sync response before the event response so the assertion proves the takeover event, not merely reconnect, flips the indicator.
- Adjacent issues parked: none.
