---
updated: 2026-06-15
provenance: agent-synthesis
campaign: sse-client-pattern
facet: testing
---

# SSE Client Pattern — Testing Facet

**Scope:** how to unit/integration-test a browser SSE consumer (a React 19 hook/provider
wrapping `EventSource`) in the platform's stack — **Vitest 4 + jsdom 26 + @testing-library/react
16**. Transport mechanics and the React integration shape are sibling facets; this facet settles
only the test-harness questions.

**Stack as observed in `apps/web` (lens, not citation):** `vitest.config.ts` already runs
`environment: "jsdom"`, `restoreMocks: true`, and `unstubGlobals: true`; `tests/setup.ts` already
polyfills missing jsdom globals (`ResizeObserver`, `Element.prototype.scrollTo`) with the exact
guard-then-assign pattern this facet recommends for `EventSource`; and `vi.stubGlobal` + fake
timers are already idiomatic across the suite. So every recommendation below lands on patterns the
codebase already uses — no new dependency or config change is required for the baseline approach.

---

## 1. Does jsdom implement `EventSource`? (the determining question)

**No.** jsdom provides no `EventSource` global. The jsdom README's "Unimplemented parts of the web
platform" section names only **Navigation** and **Layout** as explicitly scoped-out, and otherwise
states jsdom "has many missing APIs" that it simply "[hasn't] gotten to yet" [jsdom-readme-unimplemented]{1}.
A full-text search of the README for "EventSource", "Server-Sent", and "event-stream" returns no
matches [jsdom-readme-unimplemented]{1} — jsdom does not document `EventSource` as supported
anywhere. Consequence: in the jsdom test environment, `new EventSource(...)` throws (the constructor
is undefined), so **the consumer-under-test must be supplied an `EventSource` by the test harness.**

The real `EventSource` interface this fake must imitate: it extends `EventTarget`; its constructor
takes `(url, { withCredentials })`; it dispatches `open`, `message`, and `error` events (plus ad-hoc
named events keyed to the stream's `event:` field, consumed via `addEventListener(<name>, ...)`);
`message` events are `MessageEvent` objects carrying a `.data` property; `readyState` is `CONNECTING`
(0) / `OPEN` (1) / `CLOSED` (2); and `close()` tears the connection down [mdn-eventsource]{2}.

**Three options for supplying it**, in the order this facet recommends:

1. **Mock the global `EventSource` with a hand-rolled fake class** (recommended default — zero new
   deps, matches existing codebase patterns). Replace the global with `vi.stubGlobal` or a
   guard-then-assign in `tests/setup.ts`; the fake exposes test-side methods to drive `open`/
   `message`/`error` into the consumer. Details in §2–§3.
2. **Use a published fake-EventSource utility** (`eventsourcemock`) — a drop-in fake + instance
   registry. Saves writing the class but pulls a long-unmaintained dependency (§4).
3. **Polyfill with the `eventsource` npm package** — a real WHATWG-compliant client. This is a
   *real network client*, not a test double: it will attempt actual HTTP connections, so it suits
   running the consumer against a real/mock SSE server (a heavier integration test), not isolated
   unit tests. Its README positions it as a runtime client for Node/Deno/Bun/browsers, "not
   specifically a jsdom polyfill" [eventsource-npm-readme]{3}. **Not recommended for unit tests.**

A fourth design-time option — **injecting the `EventSource` constructor as a dependency** of the
hook (default `globalThis.EventSource`, overridable in tests) — sidesteps global-stubbing entirely
and is the cleanest for testability, but it is a *consumer-design* choice that belongs to the sibling
React-integration facet, not a harness technique. Flagged here as the disconfirming alternative to
"you must stub the global" (see §Disconfirming analysis).

## 2. Idiomatic Vitest pattern for faking the `EventSource` global

`vi.stubGlobal(name, value)` replaces a global for the test and is restored by
`vi.unstubAllGlobals()`; in a jsdom environment the stub is applied to `window`/`top`/`self`/`parent`
*and* `globalThis`, so code that reads bare `EventSource`, `window.EventSource`, or
`globalThis.EventSource` all see the fake [vitest-vi-stubglobal]{4}. Restoration only works because
the value went through `stubGlobal` — a direct `globalThis.EventSource = ...` assignment is not
tracked and won't auto-restore [vitest-vi-stubglobal]{4}. (The platform's `unstubGlobals: true`
config flag drives that restoration automatically between tests — observed in `vitest.config.ts`;
the config-flag semantics are a separate config-reference surface not fetched here.)

**The fake class** is an `EventTarget` subclass that records constructed instances and exposes
test-only emit helpers. Sketch (illustrative, composed from the cited APIs — not a verbatim source
quote):

```ts
class FakeEventSource extends EventTarget {
  static instances: FakeEventSource[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  url: string;
  withCredentials: boolean;
  readyState = FakeEventSource.CONNECTING;
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;

  constructor(url: string | URL, init?: { withCredentials?: boolean }) {
    super();
    this.url = String(url);
    this.withCredentials = init?.withCredentials ?? false;
    FakeEventSource.instances.push(this);
  }
  close() { this.readyState = FakeEventSource.CLOSED; }

  // test-side drivers
  _open() {
    this.readyState = FakeEventSource.OPEN;
    const e = new Event("open");
    this.onopen?.(e); this.dispatchEvent(e);
  }
  _message(data: string, type = "message") {
    const e = new MessageEvent(type, { data });
    if (type === "message") this.onmessage?.(e);
    this.dispatchEvent(e);            // named events reach addEventListener(type, …)
  }
  _error() {
    const e = new Event("error");
    this.onerror?.(e); this.dispatchEvent(e);
  }
}
```

Extending the real DOM `EventTarget` (provided by jsdom) and dispatching real `Event`/`MessageEvent`
objects keeps the fake on the same dispatch surface as the spec, which defines `EventSource` as an
`EventTarget` carrying `open`/`message`/`error` events and `MessageEvent.data` [mdn-eventsource]{2}: a
consumer that registers via `addEventListener` *or* via the `onmessage`/`onopen`/`onerror` handler
properties is exercised the same way it runs in production, and named events route correctly because
`dispatchEvent` keys listeners by event type [mdn-eventsource]{2}. Install it per-test with `vi.stubGlobal("EventSource", FakeEventSource)`, or
once in `tests/setup.ts` behind the same `typeof globalThis.EventSource === "undefined"` guard the
platform already uses for `ResizeObserver`.

`vi.fn()` can wrap `close` (or the constructor) when a test needs to assert it was called — e.g.
asserting the hook's cleanup closed the stream on unmount [vitest-vi-stubglobal]{4}.

## 3. Driving events into the fake from a `@testing-library/react` test

Render the consumer hook with `renderHook(() => useLiveStream(url))`; the latest committed return
value is read from `result.current`, props are re-pushed with `rerender`, and the hook's cleanup
(its effect calling `EventSource.close()`) fires on `unmount` [rtl-renderhook-act]{5}. The flow:

1. `renderHook` mounts the hook → its effect constructs the (fake) `EventSource` → the instance lands
   in `FakeEventSource.instances`. Grab it: `const es = FakeEventSource.instances.at(-1)!`.
2. Drive a lifecycle event from test code: `act(() => es._open())`, then
   `act(() => es._message(JSON.stringify({ live: true })))`, then assert against `result.current`.
3. **Wrap every emit in `act(...)`.** An event fired into the fake from test code originates *outside*
   React's event system, so the state update it triggers must be flushed inside `act` before
   assertions — import `act` from `@testing-library/react`, which forwards to React's own `act`
   [rtl-renderhook-act]{5}. (For consumers whose handlers do async work, use the async `act`/`await`
   form; the library forwards async-act behavior to React 19, it does not redefine it
   [rtl-renderhook-act]{5}.)
4. Assert the consumer's reaction off `result.current` (or rendered output for a provider/component
   test driven the same way).

**Reconnection with fake timers.** A native `EventSource` reconnects itself — but jsdom provides no
native one, so reconnect behavior only exists in a test if *the consumer itself* schedules a
reconnect (a `setTimeout`/`setInterval` after `error`/`close`). Where it does, drive it
deterministically: `vi.useFakeTimers()` wraps `setTimeout`/`setInterval`/`Date`
[vitest-fake-timers]{6}; emit `_error()`, then advance with `vi.advanceTimersByTime(backoffMs)` (or
`advanceTimersByTimeAsync` if the reconnect callback awaits) [vitest-fake-timers]{6} and assert a new
instance was constructed (`FakeEventSource.instances.length` grew). Prefer `advanceTimersByTime` /
`runOnlyPendingTimers` over `runAllTimers` for a self-rearming backoff loop, since `runAllTimers`
throws after 10,000 iterations on an unbounded interval [vitest-fake-timers]{6}. Pair fake timers
with `act` so the reconnect-driven re-render flushes. If reconnection is instead delegated to the
native browser EventSource, there is no consumer-side timer to fake and this paragraph does not apply
— the disconfirming note in §Disconfirming analysis covers that branch.

## 4. Published fake-EventSource utilities

`eventsourcemock` (gcedo/tamlyn lineage, npm `2.0.0`) is the drop-in that surfaced most often in
the search for this facet: a setup file sets `window.EventSource` to the mock; the test pulls the constructed instance from a `sources`
registry and drives it with `emitOpen()`, `emitMessage()`, `emitError()`, or the generic
`emit(eventName, messageEvent)` (passing a real `MessageEvent`); the mock carries `readyState`/`url`/
`withCredentials`/`onopen`/`onmessage`/`onerror`/`addEventListener`/`close()`
[eventsourcemock-readme]{7}. Its README targets Jest's `setupFiles`, but nothing in the API is
Jest-specific — it defines `window.EventSource` and uses standard `MessageEvent`, both portable to a
Vitest setup file [eventsourcemock-readme]{7}.

**Assessment: not recommended over the hand-rolled fake for this stack.** Two reasons, both
source-grounded: (a) the package is long-unmaintained (npm last-published years before the fetch date
per its registry metadata), so toolchain compatibility with Vitest 4 / current jsdom is unverified
from its README; (b) its internal emitter is a Node `EventEmitter` (`__emitter`), not a DOM
`EventTarget` [eventsourcemock-readme]{7} — a fidelity gap against the real spec surface, which
*is* an `EventTarget` [mdn-eventsource]{2}. The hand-rolled `EventTarget` fake in §2 is ~30 lines,
adds no dependency, extends the real DOM primitive jsdom already supplies, and matches the platform's
existing setup-file polyfill convention — so it dominates on every axis that matters here. Other
utilities surfaced (`mocksse`, `@dimak.dev/event-source-mock`) were not fetched and are not assessed.

---

## Disconfirming analysis

- **"jsdom definitely lacks EventSource"** — actively checked, not assumed. The README names only
  Navigation and Layout as scoped-out and a full-text search for EventSource/Server-Sent/event-stream
  returns nothing [jsdom-readme-unimplemented]{1}. The negative-search result is the disconfirming
  test: if jsdom shipped it, the README's supported-features prose or its source would name it; they
  don't. (jsdom 26 line — confirmed against the `apps/web` `package.json` `jsdom: ^26.1.0`.)
- **"You must stub the global"** — disconfirmed as the *only* path. Injecting the `EventSource`
  constructor as a hook dependency (default `globalThis.EventSource`, overridable in tests) removes
  the need to touch any global and is the more testable design. It is a consumer-design decision owned
  by the sibling React-integration facet, so this facet recommends global-stubbing as the
  harness-side default *given an un-injected consumer*, while explicitly naming injection as the
  superior alternative when the consumer can be shaped for it.
- **"Reconnection must be tested with fake timers"** — only true when the consumer owns the reconnect
  timer. A consumer that relies on the native `EventSource` auto-reconnect has *no* timer in jsdom
  (no native EventSource exists), so there is nothing to fake — reconnection is then a transport-facet
  concern, untestable as a client-side timer here. Fake timers apply iff the consumer schedules its
  own backoff [vitest-fake-timers]{6}.
- **`eventsourcemock` currency** — the maintenance/compatibility caveat is sourced to the package's
  own registry metadata (long-unmaintained) and its README's Node-`EventEmitter` internal
  [eventsourcemock-readme]{7}, not asserted from memory. Its actual behavior under Vitest 4 was not
  executed; the recommendation against it rests on the fidelity gap plus the hand-rolled fake's
  zero-dependency advantage, not on an observed failure.

## Contradictions

None among the fetched sources. The `eventsource` npm package and `eventsourcemock` are not in
tension — they solve different problems (real client for integration vs. test double for unit), and
the facet routes each to its proper test tier rather than choosing between them.

## Recommendation (facet verdict)

For **unit tests** of the SSE consumer hook/provider: hand-roll a ~30-line `FakeEventSource extends
EventTarget`, install it via `vi.stubGlobal("EventSource", FakeEventSource)` (or a guarded
`tests/setup.ts` assignment matching the existing `ResizeObserver` polyfill), drive `open`/`message`/
`error` from test code wrapped in `act`, assert off `result.current`, and use Vitest fake timers only
for a consumer-owned reconnect/backoff timer. No new dependency, no config change — it rides the
platform's existing jsdom + `vi.stubGlobal` + fake-timer + `renderHook` conventions. Reserve the
`eventsource` npm polyfill for a heavier integration test against a real/mock SSE server. Skip
`eventsourcemock` (unmaintained; lower DOM fidelity than a local `EventTarget` fake).

## Revisit if

- The consumer is designed with an **injected EventSource constructor** — then most of §2's
  global-stubbing collapses into passing the fake as a prop/arg; re-scope this facet to the injection
  seam and the global-stub guidance becomes a fallback for the un-injected path.
- `vitest`'s `unstubGlobals` / `fakeTimers` **config semantics** become load-bearing (e.g. needing
  `toFake` to include `queueMicrotask`) — fetch the Vitest config-reference pages, which were not
  fetched here (only the `vi`-API call surface was).
- A **maintained** fake-EventSource utility with a DOM-`EventTarget` core appears, or
  `@dimak.dev/event-source-mock` / `mocksse` are assessed — re-weigh §4's build-vs-buy call.
- jsdom ships a native `EventSource` in a future release — re-check the README's supported-features
  list; the whole "must supply one" premise would change.
