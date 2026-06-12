---
id: live-experience-redesign
kind: epic
stage: drafting
tags: [streaming]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: null
---

# Live experience redesign — the live page communicates state

## Brief
Redesign of the viewer-facing live experience (`apps/web/src/routes/live.tsx`, the
global player + mini-player, chat panel interactions), mandated by the
streaming-playout UX review go-decision (2026-06-12). Grounded in 28 audit findings
(8 major) recorded in the `streaming-playout-ux-review-viewer-audit` story body —
read them before decomposing.

The defining problems, in priority order:
1. **Status communication**: 12–15s dead-air cold start (skeleton CSS exists,
   unwired); live-creator takeover is invisible to viewers; the LIVE badge never
   renders (`type === "live"` never matches `"broadcast"` — fix the semantics, not
   just the check); no distinction between scheduled-playout and live-creator states.
2. **Mobile ergonomics**: chat occupies half the viewport with no collapse; theater
   mode silently absent; mini-player touch targets below WCAG minimum (filed:
   `a11y-viewer-mini-player-touch-target`).
3. **Anonymous experience**: type-and-fail chat gating; "Coming Soon" placeholder
   with no actionable next step.

**Born subscribed**: the status-communication arc consumes the SSE event spine
(`bold-event-spine` — see the review's event-needs list: `channel.live-state-changed`,
`playout.now-playing-changed`, `channel.viewer-count`). Children implementing live
data MUST depend on the spine's endpoint/publisher features rather than adding new
polling; set those `depends_on` edges at epic-design. Layout/ergonomics arcs are
spine-independent and can proceed immediately.
