---
id: gate-tests-live-takeover-ui-state
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
