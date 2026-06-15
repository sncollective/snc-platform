---
source_handle: eventsourcemock-readme
source_class: github-readme
fetched: 2026-06-15
source_url: https://github.com/gcedo/eventsourcemock
provenance: source-direct
substrate_confidence: source-direct
tool: eventsourcemock — README (gcedo lineage)
version: fetched 2026-06-15 (npm 2.0.0; README at github)
topic: a drop-in fake EventSource utility for tests
---

# eventsourcemock — README

## Paraphrased summary

`eventsourcemock` is a small library providing a fake `EventSource` class for
tests plus a `sources` registry that holds every instance the code-under-test
constructs. A test setup file replaces the global `EventSource` with the mock; the
test then looks up the constructed instance from `sources[url]` and drives lifecycle
events into it via `emitOpen()`, `emitMessage()`, `emitError()`, or the generic
`emit(eventName, messageEvent)`. The mock implements the standard EventSource shape:
`readyState`, `url`, `withCredentials`, `onopen`/`onmessage`/`onerror`,
`addEventListener`/`removeEventListener`, and `close()`.

## Key passages

- **Setup (replace the global):**
  ```js
  import EventSource from 'eventsourcemock';
  Object.defineProperty(window, 'EventSource', {
    value: EventSource,
  });
  ```
  (README shows this in a Jest `setupFiles` config; the mechanism — defining
  `window.EventSource` — is runner-agnostic.)

- **`sources` registry:** "sources holds the EventSource instances created."
  Imported as `import { sources } from 'eventsourcemock';`

- **Constructor:** `EventSource(url: string, options?: { withCredentials: boolean })`

- **`emit(eventName, messageEvent)`:** "Calls each of the listeners registered for
  the event named eventName, providing messageEvent as argument." Example:
  ```js
  const messageEvent = new MessageEvent('type', { data: 'message event data' });
  source.emit(messageEvent.type, messageEvent);
  ```

- **`emitOpen()`:** "Simulates the opening of a connection. It sets the ready state
  to open and invokes the callback."

- **`emitMessage()`:** "Simulates dispatching of a message, it invokes the
  onmessage callback."

- **`emitError()`:** "Simulates dispatching an error event on the EventSource
  instance. Causes onerror to be called."

- **Properties / methods:** `readyState`, `url`, `withCredentials`, `onopen`,
  `onmessage`, `onerror`, `__emitter` (internal Node `EventEmitter`),
  `addEventListener`/`removeEventListener`, `close()`.

## Structural metadata

`github-readme` (the gcedo/tamlyn lineage of `eventsourcemock`; npm `2.0.0`).
Authoritative for *this utility's* API only. Maintenance caveat: the package is
long-unmaintained (npm last-published years before fetch date) and its README
targets Jest's `setupFiles`; nothing in the documented API is Jest-specific (it
defines `window.EventSource` and uses standard `MessageEvent`), so the mechanism is
portable to a Vitest setup file, but currency/compatibility with the current
toolchain is unverified from the README alone. The `__emitter` being a Node
`EventEmitter` (not DOM `EventTarget`) is a fidelity gap vs. the real spec surface.

## Substrate-test

Usable without platform context: documents the utility's API on its own README's
terms. No project framing.
