---
source_handle: rtl-renderhook-act
source_class: tool-doc
fetched: 2026-06-15
source_url: https://testing-library.com/docs/react-testing-library/api/
provenance: source-direct
substrate_confidence: source-direct
tool: React Testing Library — renderHook / act API
version: fetched 2026-06-15 (@testing-library/react 16 line)
topic: rendering a hook under test and wrapping state updates in act
---

# React Testing Library — `renderHook` and `act`

## Paraphrased summary

`@testing-library/react` exports `renderHook(callback, options?)` for testing a
custom hook in isolation: it renders a test component that calls the hook and
exposes the latest committed return value at `result.current`, plus `rerender`
(re-invoke with new props) and `unmount`. The library also re-exports `act` — "a
light wrapper around the react `act` function" — and recommends importing `act`
from `@testing-library/react` rather than from `react` directly. State updates
that happen outside React's own event handling (e.g. an event fired into a fake
EventSource from test code) must be wrapped in `act(...)` so React flushes the
resulting re-render before assertions run.

## Key passages

- **`renderHook` signature:** `function renderHook<Result, Props, ...>(render:
  (initialProps: Props) => Result, options?: RenderHookOptions<...>):
  RenderHookResult<Result, Props>`

- **`result`:** "Holds the value of the most recently **committed** return value
  of the render-callback," accessed via `result.current`.

- **`rerender`:** "Renders the previously rendered render-callback with the new
  props."

- **`unmount`:** "Unmounts the test hook." (Triggers the hook's cleanup — e.g. an
  effect that calls `EventSource.close()`.)

- **Example:**
  ```js
  import {renderHook} from '@testing-library/react'
  test('returns logged in user', () => {
    const {result} = renderHook(() => useLoggedInUser())
    expect(result.current).toEqual({name: 'Alice'})
  })
  ```

- **`act`:** "a light wrapper around the [`react` `act` function]" that "forward[s]
  all arguments to the act function if your version of react supports `act`."
  Recommended to import from `@testing-library/react` for consistency.

## Structural metadata

`tool-doc` (React Testing Library's official API reference). Authoritative for the
`renderHook` surface (`result.current`/`rerender`/`unmount`) and the `act` re-export.
Relevant for driving an EventSource consumer hook and flushing the re-renders its
event handlers cause. The page documents that `act` forwards to React's own `act`,
so React-19 async-act behavior is inherited from React, not redefined by the
library; the page does not enumerate React-version-specific act semantics beyond
the forwarding note.

## Substrate-test

Usable without platform context: documents RTL's hook-testing API on the library's
own terms. No project framing.
