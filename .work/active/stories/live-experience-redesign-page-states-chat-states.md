---
id: live-experience-redesign-page-states-chat-states
kind: story
stage: implementing
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
   absorbs backlog `a11y-viewer-chat-viewercount-label`; **delete
   `.work/backlog/a11y-viewer-chat-viewercount-label.md` in this story's commit**.

Test file needs the shared router mock (`createRouterMock()`) for the new Link import.

## Acceptance

- [ ] Anonymous viewer sees a disabled "Sign in to chat" input + sign-in link with
      `returnTo=/live`; typing/sending impossible at both viewports
- [ ] Signed-in experience unchanged
- [ ] Empty room shows "No messages yet"
- [ ] No-room / failed-fetch shows "Chat unavailable" only after rooms resolve
- [ ] Viewer-count span exposes `aria-label="N viewer(s) in this room"`; backlog item
      file deleted
- [ ] `tests/unit/components/chat/chat-panel.test.tsx` extended per parent `## Testing`
