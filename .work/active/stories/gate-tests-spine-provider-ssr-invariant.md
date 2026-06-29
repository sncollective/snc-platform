---
id: gate-tests-spine-provider-ssr-invariant
kind: story
stage: done
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

## Implementation (2026-06-29)
- Files changed: `apps/web/tests/unit/contexts/spine-context.test.tsx`.
- Tests added: SSR `renderToString` coverage proving `SpineProvider` does not construct the injected `EventSource` constructor when `window` is unavailable.
- Verification: `bun run --filter @snc/web test -- tests/unit/contexts/spine-context.test.tsx` passed.
- Discrepancies from design: none.
- Adjacent issues parked: none.

## Review (2026-06-29)

**Verdict**: Approve

**Notes**: Fast-lane (story with green verification). Implementation verified in the implement wave: full suite green (shared 682, api 1890, web 1807, web build). No blockers or important findings above nit.
