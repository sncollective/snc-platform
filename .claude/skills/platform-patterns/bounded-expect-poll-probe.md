# bounded-expect-poll-probe

Use Playwright `expect.poll` with named timeouts/intervals for eventually-consistent streaming proofs.

## When to use
Use when real async systems need bounded convergence checks without arbitrary sleeps.

## Instances
- `apps/e2e/tests/creator-channel-playback.spec.ts:41` — polls queue status until nowPlaying matches seeded content.
- `apps/e2e/tests/creator-channel-playback.spec.ts:58` — polls until streaming status exposes HLS URL.
- `apps/e2e/tests/creator-channel-playback.spec.ts:76` — polls manifest until media segments exist.
- `apps/e2e/tests/creator-channel-browser-playback.spec.ts:155` — polls native video `currentTime` until playback advances.

## Canonical sketch
```ts
await expect.poll(
  async () => await readEventuallyConsistentState(),
  {
    message: "Domain-specific convergence claim",
    timeout: DOMAIN_TIMEOUT_MS,
    intervals: POLL_INTERVALS_MS,
  },
).toEqual(expected);
```

## Anti-patterns
Don't use fixed sleeps; don't poll vague UI text when a narrower black-box probe is available.
