---
id: live-experience-redesign
kind: epic
stage: review
tags: [streaming]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-15
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

## Design decisions (user, 2026-06-12 epic design)
- **Live-state truth source**: SRS session state AND Liquidsoap input-switch
  telemetry — the server must know which source is actually on air, covering
  takeovers that bypass SRS, not just keyed creator streams. (Rejected: SRS-only —
  leaves the Liquidsoap-bypass path invisible; client-side HLS heuristics —
  perpetuates the guessing the audit flagged.) Cross-epic consequence: the
  input-switch telemetry surface lands in `bold-event-spine-publishers` (noted on
  that feature).
- **Mobile chat layout**: stream-first restructure — player on top, tabbed/sheet
  area with chat as an opt-in tab (Twitch-mobile pattern). (Rejected: collapse-toggle
  patch — the audit found the fixed half-viewport panel structurally wrong, and this
  is a redesign epic.)
- **Mobile distraction-free affordance**: native fullscreen via the player; theater
  mode stays desktop-only. (Rejected: enabling theater at 375px — marginal gain over
  fullscreen; both — two similar affordances confuse on a small screen.)
- **Offline-state affordance**: both — honest copy + link to the existing `/calendar`
  route now (`page-states`), plus a notify-me-when-live loop scoped as its own child
  feature (`notify-me`), accepting the notification-plumbing blast radius.
- **Channel selector**: keep the native `<select>` with state indication added;
  a richer picker component is deferred until channel count grows past ~4 (audit:
  tolerable at current count).

## Decomposition

Split by capability along the audit's three problem families, with the conversion
loop separated for dependency hygiene: the spine-consumer arc (`live-state`) carries
the cross-epic dependencies; the two spine-independent arcs (`page-states`,
`layout-ergonomics`) can start immediately; `notify-me` hangs off the server-side
live-state representation rather than blocking the offline-state fix shipping first.

### Child features

- `live-experience-redesign-page-states` — honest loading/offline/empty/gated states
  (skeleton, calendar link, anon chat pre-gating, HLS error) — depends on: `[]`
- `live-experience-redesign-layout-ergonomics` — stream-first mobile restructure,
  native fullscreen, touch targets, desktop control polish — depends on: `[]`
- `live-experience-redesign-live-state` — server live-state truth + honest
  indicators, born subscribed — depends on: `[bold-event-spine-sse-endpoint,
  bold-event-spine-publishers]` (cross-epic)
- `live-experience-redesign-notify-me` — notify-me-when-live conversion loop —
  depends on: `[live-experience-redesign-live-state]`

### Decomposition risks

- **Write overlap, not dependency overlap**: `page-states` and `layout-ergonomics`
  are independent but both edit `live.tsx`/`live.module.css` heavily. They
  parallelize at design time; at implementation the orchestrator should bundle or
  serialize them rather than running them as parallel writers.
- **Cross-epic critical path**: `live-state` (and transitively `notify-me`) waits on
  two spine features that are themselves undesigned. If the spine slips, this epic
  still ships its two independent features — but the epic's defining theme (status
  truth) is the part that waits.
- **Indicator placement coordination**: `live-state` owns what indicators say;
  `layout-ergonomics` owns where status lives in the restructured mobile layout.
  Whichever designs second must read the other's design section.

## Children complete (2026-06-15)
All 4 child features done: layout-ergonomics, page-states, live-state (server+client, SSE SpineProvider, verified live), notify-me (per-channel OTP-subscribe + go-live dispatch + offline capture form, adversarial-reviewed). Epic ready for review/close.
