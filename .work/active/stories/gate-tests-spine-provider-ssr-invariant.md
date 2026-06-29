---
id: gate-tests-spine-provider-ssr-invariant
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

# SpineProvider SSR/client-only invariant is not tested

## Priority
Critical

## Spec reference
Item: `live-experience-redesign-live-state-spine-store`
Acceptance criterion: "No SSR open attempt (EventSource is client-only; provider effect is client-side)."

## Gap type
missing test for error case

## Suggested test
```tsx
it("does not construct EventSource during server render", () => {
  const ctor = vi.fn();
  renderToString(
    <SpineProvider topics={["live"]} eventSourceCtor={ctor as unknown as typeof EventSource}>
      <div />
    </SpineProvider>,
  );
  expect(ctor).not.toHaveBeenCalled();
});
```

## Test location (suggested)
`apps/web/tests/unit/contexts/spine-context.test.tsx`
