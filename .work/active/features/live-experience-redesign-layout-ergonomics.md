---
id: live-experience-redesign-layout-ergonomics
kind: feature
stage: drafting
tags: [streaming]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: live-experience-redesign
---

# Layout ergonomics — stream-first mobile, fullscreen, controls

## Brief
The page layout serves watching. Mobile is restructured stream-first (epic design
decision): player on top, then a tabbed/sheet area where chat is one opt-in tab
(Twitch-mobile pattern) — replacing today's fixed 400px always-on chat panel that
consumes half the viewport with no collapse (sev-3). Mobile gains a distraction-free
affordance via the player's native fullscreen (Vidstack supports it; theater mode stays
desktop-only — epic design decision). Mini-player touch targets are raised to a 44px
target (absorbs backlog item `a11y-viewer-mini-player-touch-target` — close it when
this lands; sev-3 on mobile at today's 24×24px). Desktop control polish rides along:
the theater toggle gets a stable low-opacity resting state instead of opacity:0 (it's
undiscoverable today, sev-2), and the Unicode-glyph controls (⤢, ✕, →, ←) are replaced
with recognizable panel/theater icons (sev-1 ×2).

Spine-independent: pure layout/interaction work, no live-data dependency. Does NOT
cover what the indicators say (sibling `live-state` owns badge semantics — but this
feature owns WHERE status surfaces live in the mobile layout, so coordinate placement
during design) or page states (sibling `page-states`).

Audit grounding: viewer findings V2 (theater/chat-collapse family) and V4
(mini-player targets) in the `streaming-playout-ux-review-viewer-audit` story
(archived; body at git 85151fd). Mini-player reload persistence (V4, sev-1) is
explicitly deferred — not in scope.

## Epic context
- Parent epic: `live-experience-redesign`
- Position in epic: independent capability — parallel to `page-states`. Both touch
  `live.tsx` heavily; see the epic's decomposition risks for the write-overlap note.

## Foundation references
- `docs/ux-decisions.md` — mobile-ergonomics evidence (bottom-tabs, touch targets)
