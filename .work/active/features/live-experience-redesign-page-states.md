---
id: live-experience-redesign-page-states
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

# Honest page states — loading, offline, empty, gated

## Brief
Every state the live page can be in says what's happening and what to do next. Covers:
the 12–15s cold-start dead air (wire a pulsing 16:9 player skeleton — the
`playerSkeleton` class already exists orphaned in `live.module.css:161`; also a
loading state for the channel-selector zone during the initial fetch), a custom HLS
error state (today Vidstack's native error then silent clear), the offline state
(replace "Coming Soon — stay tuned" with honest "Nothing live right now" copy plus a
link to the existing `/calendar` route showing upcoming events, per the epic's design
decision), anonymous chat pre-gating (disable the input with "Sign in to chat" + login
link instead of today's type-send-fail-toast pattern — sev-3 both viewports), the chat
empty state ("No messages yet"), and the chat viewer-count accessible label (absorbs
backlog item `a11y-viewer-chat-viewercount-label` — close it when this lands).

Spine-independent by design: nothing here needs live data that polling doesn't already
provide, so this feature can start immediately. Does NOT cover the notify-me
subscription affordance (sibling `notify-me` — the offline state links to calendar
now; notify-me adds its capture affordance to the same surface when it lands) or live
indicators (sibling `live-state`).

Audit grounding: viewer findings V1 (skeleton sev-3 ×2, loading sev-2, ComingSoon
sev-2) and V5 (anon gating sev-3 ×2, empty chat sev-2, viewer-count sev-2), plus the
state-inspection table's six handled-poorly verdicts, in the
`streaming-playout-ux-review-viewer-audit` story (archived; body at git 85151fd).

## Epic context
- Parent epic: `live-experience-redesign`
- Position in epic: independent capability — no dependencies, can be designed and
  implemented first while the spine features land.

## Foundation references
- `docs/streaming.md` — viewer flow
- `docs/ux-decisions.md` — error-prevention and status-visibility evidence
