---
id: live-experience-redesign-page-states-chat-states
kind: story
stage: done
tags: [streaming]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: live-experience-redesign-page-states
---

# Chat pre-gating, empty state, unavailable state, viewer-count label

Implements **Unit 3** of the parent feature's design (read `## Implementation Units`
→ Unit 3 in the parent body for exact signatures, branch structure, and notes).

## Scope

`apps/web/src/components/chat/chat-panel.tsx` +
`apps/web/src/components/chat/chat-panel.module.css` only. Four changes on one
surface:

1. **Anonymous pre-gate**: when `state.currentUserId === null`, render a disabled
   input ("Sign in to chat") plus a sign-in `Link` built from
   `buildLoginRedirect("/live")` — replaces today's type-send-fail-toast pattern
   (sev-3, both viewports).
2. **Empty state**: "No messages yet" in the messages area when
   `state.messages.length === 0`.
3. **Unavailable state**: `roomsLoaded` flag (set in `loadRooms` try/finally) gates a
   "Chat unavailable" banner when no joinable room exists or the rooms fetch failed —
   never a silent blank, no flash before rooms resolve.
4. **Viewer-count accessible name**: pluralized `aria-label` on the count span —
   absorbs backlog item `a11y-viewer-chat-viewercount-label`; deleted in this story's
   commit.

Test file needs the shared router mock (`createRouterMock()`) for the new Link import.

## Acceptance

- [x] Anonymous viewer sees a disabled "Sign in to chat" input + sign-in link with
      `returnTo=/live`; typing/sending impossible at both viewports
- [x] Signed-in experience unchanged
- [x] Empty room shows "No messages yet"
- [x] No-room / failed-fetch shows "Chat unavailable" only after rooms resolve
- [x] Viewer-count span exposes `aria-label="N viewer(s) in this room"`; backlog item
      file deleted
- [x] `tests/unit/components/chat/chat-panel.test.tsx` extended per parent `## Testing`

## Implementation notes

Four changes applied to `chat-panel.tsx` and `chat-panel.module.css` exactly per the parent feature design (Unit 3):

- **Anonymous pre-gate**: `isAnonymous` flag (`state.currentUserId === null`) added. When an open room is active and the user is anonymous, the input section renders a disabled input ("Sign in to chat") + a `Link` to `/login?returnTo=%2Flive` (built from `buildLoginRedirect("/live")` + conditional search spread for `exactOptionalPropertyTypes` conformance). No Send button in the gated row.
- **Empty state**: `{state.messages.length === 0 && <p className={styles.emptyState}>No messages yet</p>}` inserted above the message map.
- **Unavailable state**: `loadRooms` wrapped in try/catch/finally; `setRoomsLoaded(true)` fires in `finally`. The input four-way branch shows `"Chat unavailable"` (reusing `.closedBanner`) only after `roomsLoaded` is true and no active room exists. No flash before rooms resolve.
- **Viewer-count aria-label**: pluralized `aria-label` on the viewer-count span — `"N viewer in this room"` / `"N viewers in this room"`.
- **CSS additions**: `.emptyState` (muted, centered, `var(--space-md)` padding, `var(--font-size-sm)`) and `.signInLink` (accent color, no underline, underline on hover, `white-space: nowrap`). Reused existing `.inputForm` / `.input` for the gated row.

Test file changes: added `vi.mock("@tanstack/react-router", () => createRouterMock())`, added `OPEN_ROOM` fixture, updated `disables input when timed out` and `disables input when banned` tests to pass `currentUserId: "user-1"` (they previously had `null` via `DEFAULT_CHAT_STATE` which would now hit the anon gate), added 11 new test cases across 4 new describe blocks.

Test results: 1642 tests passed across 153 files. Build: clean.

## Review (2026-06-13)

**Verdict**: Approve — held at review on fix-verify loopback (user confirms in the
running app). Feature-level deep review verified design conformance, acceptance
criteria, and a11y of the new states; full web suite green.
Acceptance boxes ticked by the reviewer (verified satisfied; the implement roll-up
missed this story's boxes). Nit accepted: rooms-fetch failure branch untested.
a11y-viewer-chat-viewercount-label confirmed genuinely absorbed (stub deleted in
b3edae4, fix matches the item's direction, both pluralization cases tested).

**User fix-verify: confirmed 2026-06-13.** Anon-gate confirmed earlier; empty-chat 'No messages yet' walked live on S/NC Classics (one residual seed message cleared from that room to expose the state). Closed.
