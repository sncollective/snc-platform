---
source_handle: vitest-vi-stubglobal
source_class: tool-doc
fetched: 2026-06-15
source_url: https://vitest.dev/api/vi.html
provenance: source-direct
substrate_confidence: source-direct
tool: Vitest — Vi utility API (vi.stubGlobal, vi.fn, vi.spyOn)
version: fetched 2026-06-15 (Vitest 4.x docs)
topic: stubbing a global in Vitest and restoring it
---

# Vitest — `vi.stubGlobal` / `vi.fn` / `vi.spyOn`

## Paraphrased summary

Vitest's `vi` utility provides `vi.stubGlobal(name, value)` to replace a global
variable's value for the duration of a test, restorable via
`vi.unstubAllGlobals()`. In a jsdom or happy-dom environment the stub is applied
to `window`, `top`, `self`, and `parent` in addition to `globalThis`, so a global
constructor stubbed this way is visible to code that reads `window.EventSource` or
the bare `EventSource` identifier. `vi.fn()` creates a tracked mock function;
`vi.spyOn(object, key)` wraps an existing method as a tracked spy.

## Key passages

- **`vi.stubGlobal` signature:** `function stubGlobal(name: string | number |
  symbol, value: unknown): Vitest`

- **Purpose:** "This method changes the value of a global variable. You can restore
  its original value by calling `vi.unstubAllGlobals`." (Original value restored by
  calling `vi.unstubAllGlobals`.)

- **Environment behavior:** "If you are using `jsdom` or `happy-dom`," the stub
  also affects `window` (and `top`, `self`, `parent`), not only `globalThis`. The
  doc's example: `vi.stubGlobal('innerWidth', 100)` then `innerWidth === 100`,
  `globalThis.innerWidth === 100`, and `window.innerWidth === 100`.

- **Restoration caveat:** Restoration is available because the stub goes through
  `vi.stubGlobal`. "Directly assigning the value to `globalThis` or `window`" (i.e.
  bypassing `stubGlobal`) is not tracked and cannot be auto-restored.

- **`vi.fn`:** `function fn(fn?: Procedure | Constructable): Mock` — "Creates a spy
  on a function, though can be initiated without one." Tracks calls, arguments,
  return values, and instances.

- **`vi.spyOn`:** `function spyOn<T, K extends keyof T>(object: T, key: K,
  accessor?: 'get' | 'set'): Mock` — creates a tracked spy on an object's method or
  accessor.

## Structural metadata

`tool-doc` (Vitest's official `vi` API reference). Authoritative for the
stub-a-global mechanism and its jsdom/happy-dom window-binding behavior — the
relevant detail for replacing the missing `EventSource` global with a fake class.
The `restoreMocks` / `unstubGlobals` *config* flags that automate restoration
per-test are a separate config surface (config reference page); this attestation
covers the `vi`-API call surface only.

## Substrate-test

Usable without platform context: documents Vitest's global-stubbing API on the
tool's own terms. No project framing.
