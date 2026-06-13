---
id: live-experience-redesign-layout-ergonomics-mobile-tabs
kind: story
stage: implementing
tags: [streaming]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: live-experience-redesign-layout-ergonomics
---

# Mobile stream-first tab restructure

Implements **Unit 1** of the parent feature's design (read `## Implementation Units`
→ Unit 1 in the parent body for exact signatures, CSS, and notes).

## Scope

`apps/web/src/contexts/global-player-context.tsx` (new `liveMobileChatOpen` field +
`setLiveMobileChatOpen` action + reducer case), `apps/web/src/routes/live.tsx`
(ephemeral `mobileChatOpen` state, `MobileTabBar` with tablist ARIA, info-sections
tabpanel wrapper, widened chat-portal render condition + `chatTabPanel` wrapper,
signal effect), `apps/web/src/routes/live.module.css` (tab bar classes, mobile-only
hide rules), `apps/web/src/routes/__root.tsx` (`liveGridMobileChat` class
composition), `apps/web/src/routes/__root.module.css` (chatPortal hidden-by-default
base, viewport-filling chat-open column). Plus tests:
`tests/unit/contexts/global-player-context.test.tsx`, `tests/unit/routes/live.test.tsx`.

Replaces the fixed always-on 400px mobile chat band (sev-3) with the Twitch-mobile
pattern: player on top, `Info | Chat` tabs below the always-visible channel
selector + status row, chat opt-in and viewport-filling. Desktop is structurally
untouched.

## Acceptance

- [ ] Mobile (<768px), streaming: player → selector/status row → `Info | Chat` tabs →
      info content; chat NOT visible by default
- [ ] Chat tab hides info sections and fills the viewport below the tabs; Info
      restores
- [ ] Tab state ephemeral; tabs absent while offline/loading
- [ ] Desktop (≥768px) behavior unchanged (existing tests pass)
- [ ] Tablist/tab/aria-selected/aria-controls wiring per design
- [ ] Context reducer tests cover the new field + action; live route tests cover tab
      rendering and signal calls
