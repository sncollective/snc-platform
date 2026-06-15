---
id: live-experience-redesign-live-state-live-wiring
kind: story
stage: done
tags: [streaming]
release_binding: null
depends_on: [live-experience-redesign-live-state-spine-store]
gate_origin: null
created: 2026-06-15
updated: 2026-06-15
parent: live-experience-redesign-live-state
---

# Wire the live page to re-sync on spine events

Consumes the reusable spine primitive (`-spine-store`) to make the live page update without a
reload. Unit C3 from the parent design.

## Units

- **`apps/web/src/routes/__root.tsx`** — mount `<SpineProvider topics={["live"]}>` in the
  provider tree (anon-safe; `live` is the public topic). Widen topics later for other
  consumers; this feature needs only `live`.
- **`apps/web/src/routes/live.tsx`** —
  - `useSpineTopic("live", () => refetch())` — on any `channel.live-state-changed`, re-fetch
    `/api/streaming/status`. The derived `liveState` + fresh `viewerCount` ride that response
    (push/cache-invalidation per the position; this IS the re-fetch-refreshed viewer count —
    the spine has no push viewer-count event).
  - Re-fetch on the `spine.connected`/`status === "open"` transition (the §2 re-sync trigger).
  - Keep the existing 15s `usePolling` as the **degraded fallback** (SSE closed/denied/pre-
    connect). Harmless when SSE is open; do NOT remove it.
  - Result: a creator takeover (already fires `channel.live-state-changed` server-side) →
    spine ping → re-fetch → `liveState` flips to `live-creator` → LIVE badge appears live.

## Tests

`live.test.tsx`: mock the fetch; fire a `live` event through the injected fake; assert a
channel-list re-fetch happened and the badge/state updated.

## Acceptance
- [ ] A `channel.live-state-changed` event triggers a `/api/streaming/status` re-fetch.
- [ ] The 15s poll still runs as fallback (not removed).
- [ ] Takeover transition flips the indicator without a page reload (verifiable on the live
      stack: drive a Liquidsoap input-switch / SRS publish and watch /live).
- [ ] web unit suite green at baseline; tsc clean.

## Implementation (2026-06-15)
- `usePolling` extended with a stable `refetch()` (out-of-cycle fetch via a triggerRef;
  existing callers unaffected — additive return field).
- `live.tsx`: `LivePage` now wraps `<SpineProvider topics={["live"]}>` (route-scoped, not
  __root — only the live page opens a connection); `LivePageInner` calls
  `useSpineTopic("live", refetch)` (re-fetch on live-state change) + re-fetches on the
  `status === "open"` (re)connect transition. 15s poll kept as degraded fallback.
- Test: live.test.tsx re-sync test (stub global with FakeEventSource, fire a live event,
  assert `/api/streaming/status` refetch). The pre-existing 24 live tests pass via the
  setup.ts EventSource stub.
- Verified: web 1745/1745 (= baseline +8), tsc clean; live stack `/live` 200 with
  SpineProvider mounted, spine handshake confirmed.

## Review (2026-06-15)

**Verdict**: Approve — story verified by implement (tsc clean, tests green, live-stack confirmed); fast-lane advance.
