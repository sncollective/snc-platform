---
id: live-experience-redesign-live-state
kind: feature
stage: drafting
tags: [streaming]
release_binding: null
depends_on: [bold-event-spine-sse-endpoint, bold-event-spine-publishers]
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: live-experience-redesign
---

# Live-state truth and indicators

## Brief
The viewer UI tells the truth about what's on air. Server-side, channel live-state
becomes a first-class representation: "live creator on air" vs "scheduled playout" vs
"offline", derived from BOTH SRS session state (on_publish/on_unpublish — the
production creator path) AND Liquidsoap input-switch telemetry (which source the
playout engine is actually airing — covers takeovers that bypass SRS), per the epic's
design decision. Client-side, the live page consumes `channel.live-state-changed` and
`playout.now-playing-changed` over the SSE spine and renders honest indicators: a LIVE
badge that actually fires (today `type === "live"` never matches `"broadcast"` —
`live.tsx:290` — fix the semantics, not just the check), an On-Air/Scheduled state for
playout channels, visible takeover/fall-back transitions, channel-type indication in
the channel selector (keep the native `<select>` — a richer picker is deferred until
channel count grows past ~4, per the audit), and spine-fed viewer count.

Born subscribed: this feature adds NO new polling. It consumes the spine endpoint and
events; the 15s channel-list poll survives only as the degraded fallback path. Does NOT
cover loading/offline/empty states (sibling `page-states`), mobile layout (sibling
`layout-ergonomics`), or the notify-me trigger consumer (sibling `notify-me` depends on
this feature's server-side live-state representation).

Audit grounding: viewer findings V1 (selector/status-bar semantics, sev-2s) and V3
(takeover invisibility, sev-3 both viewports) in the
`streaming-playout-ux-review-viewer-audit` story (archived; body at git 85151fd).

## Coordination note (2026-06-12, unified-channel-model workshop)
The server-side live-state representation this feature establishes IS the
`unified-channel-model` epic's airing state (identity/state split: channel identity
separate from airing = live / playout / offline). Design it as that model's state
field, not a viewer-page-local concept — read `unified-channel-model` before
committing the shape. Under that model the LIVE-badge bug class becomes
unrepresentable, which simplifies this feature's client half.

## Epic context
- Parent epic: `live-experience-redesign`
- Position in epic: the spine-consumer arc — blocked on `bold-event-spine-sse-endpoint`
  and `bold-event-spine-publishers` (cross-epic edges). The server-side live-state
  representation this feature establishes is what sibling `notify-me` triggers from.

## Foundation references
- `docs/streaming.md` — three-layer architecture, channel model, stream flow
- `docs/ux-decisions.md` — status-visibility evidence base
