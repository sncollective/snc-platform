---
id: story-testing-live-page-chat-panel-render
kind: story
stage: done
tags: [testing, community]
release_binding: 0.3.0
created: 2026-04-24
updated: 2026-04-24
related_decisions: []
related_designs: []
parent: null
---

Surfaced by the 0.3.0 testing-gate triage. The live page's chat panel — the primary real-time interaction during the Animal Future livestream — has zero render-level coverage. [live-streaming.spec.ts](../../apps/e2e/tests/live-streaming.spec.ts) covers the channel selector and theater-mode button; it never asserts the chat panel mounts.

A silent regression (import error in `chat-context.tsx`, WebSocket URL misconfiguration, context crash under the new moderator-gate security fix, etc.) would leave a blank sidebar during the livestream.

## What changes

Extend `live-streaming.spec.ts` in the existing authenticated block — navigate to `/live`, wait for the channel to load, assert that the chat composer/input is visible. Render-level check only; WebSocket round-trip is out of scope for this test (post-0.3.0).

Use semantic selectors consistent with the rest of the suite: `getByRole('textbox', { name: /message/i })` or `getByPlaceholder(/type a message/i)` — verify against the actual `ChatInput` component markup when writing the test.

## Tasks

- [ ] Inspect `apps/web/src/components/chat/chat-input.tsx` (or equivalent) to identify the stable accessible name for the chat input.
- [ ] Add `test("chat panel renders with input", ...)` in the authenticated block of live-streaming.spec.ts.
- [ ] Verify by running `bun run --filter @snc/e2e test -- live-streaming.spec.ts`.

## Verification

- New test passes against staging with a seeded auth state.
- Test does not depend on WebSocket connectivity — the chat context may be in a disconnected state; the input should still render.

## Risks

Minor — if the chat input only renders when the WebSocket connects (vs. always rendering with a disabled state), the test might false-negative in offline staging. Inspect the component during implementation and adjust the assertion to a structural guarantee (e.g., the chat panel region is visible, even if the input is disabled).
