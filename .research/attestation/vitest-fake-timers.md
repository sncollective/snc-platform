---
source_handle: vitest-fake-timers
source_class: tool-doc
fetched: 2026-06-15
source_url: https://vitest.dev/api/vi.html
provenance: source-direct
substrate_confidence: source-direct
tool: Vitest — fake timers API (useFakeTimers, advanceTimersByTime, ...)
version: fetched 2026-06-15 (Vitest 4.x docs)
topic: deterministic timer control in Vitest tests
---

# Vitest — Fake Timers (`vi.useFakeTimers` and advancement)

## Paraphrased summary

Vitest's fake-timer API (backed by `@sinonjs/fake-timers`) replaces the runtime's
timer functions so a test can advance simulated time deterministically.
`vi.useFakeTimers()` wraps `setTimeout`, `setInterval`, `clearTimeout`,
`clearInterval`, `setImmediate`, `clearImmediate`, and `Date`; `vi.useRealTimers()`
restores them and discards anything scheduled. Time is advanced explicitly with
`vi.advanceTimersByTime(ms)` (sync) or `vi.advanceTimersByTimeAsync(ms)` (which
also drains asynchronously-set timers), or flushed with `vi.runAllTimers()` /
`vi.runOnlyPendingTimers()`. This is the lever for testing a reconnect/backoff
timer without waiting real wall-clock time.

## Key passages

- **`vi.useFakeTimers`:** "To enable mocking timers, you need to call this method.
  It will wrap all further calls to timers (such as `setTimeout`, `setInterval`,
  `clearTimeout`, `clearInterval`, `setImmediate`, `clearImmediate`, and `Date`)"
  until `vi.useRealTimers()` is called. Uses `@sinonjs/fake-timers` internally.
  Does **not** mock `process.nextTick` / `queueMicrotask` by default (enable via
  the `toFake` option).

- **`vi.useRealTimers`:** "When timers have run out, you may call this method to
  return mocked timers to its original implementations. All timers that were
  scheduled before will be discarded."

- **`vi.advanceTimersByTime(ms)`:** "This method will invoke every initiated timer
  until the specified number of milliseconds is passed or the queue is empty —
  whichever comes first." Example: an interval logging every 50ms, after
  `vi.advanceTimersByTime(150)`, logs 1, 2, 3.

- **`vi.advanceTimersByTimeAsync(ms)`:** same as above but "This will include
  asynchronously set timers." Returns a `Promise`.

- **`vi.runAllTimers`:** "This method will invoke every initiated timer until the
  timer queue is empty." Throws after 10,000 tries on an infinite interval
  (configurable via `fakeTimers.loopLimit`).

- **`vi.runOnlyPendingTimers`:** "This method will call every timer that was
  initiated after `vi.useFakeTimers` call. It will not fire any timer that was
  initiated during its call." (Avoids re-arming an interval into infinite recursion.)

## Structural metadata

`tool-doc` (Vitest's official `vi` timer API). Authoritative for deterministic
time control in tests. Relevant for this facet only when the EventSource consumer
under test schedules its own reconnect timer (a `setTimeout`/`setInterval`); if
reconnection is delegated to the native EventSource (which jsdom does not provide)
the consumer has no timer to fake and this surface does not apply. The `async`
advancement variants matter when the reconnect callback awaits.

## Substrate-test

Usable without platform context: documents Vitest's fake-timer API on the tool's
own terms. No project framing.
