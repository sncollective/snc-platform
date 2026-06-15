---
id: live-experience-redesign-live-state
kind: feature
stage: drafting
tags: [streaming]
release_binding: null
depends_on: [bold-event-spine-sse-endpoint, bold-event-spine-publishers, live-state-sse-client-pattern]
gate_origin: null
created: 2026-06-12
updated: 2026-06-15
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

## Design decisions (2026-06-15 feature-design)

- **Rich-state delivery: re-fetch hint + derived field** (not event-payload enrichment).
  The SSE `channel.live-state-changed` event stays a lightweight "something changed on
  channel X" ping; the client re-fetches `/api/streaming/status`, which gains a derived
  `liveState` tri-state field. Rationale: single source of truth (the channel-list
  endpoint, which already fuses SRS + Liquidsoap in `srs.ts`); reuses the
  already-shipped `content.processing-status-changed` "hint only, re-fetch" pattern
  (`events.ts:34`); no change to the shipped spine event schema other consumers rely on;
  the `playout` topic being admin-only stops mattering (viewer needs only the public
  `live` ping). Rejected: enriching the event payload — creates a second source of truth
  to keep consistent and optimizes away a non-hot-path round-trip (live-state transitions
  are seconds-to-minutes apart). The server half (the derived `liveState` field + the
  LIVE-badge semantics fix) needs no research and can proceed.

- **Client SSE consumer: gated on a research input.** This feature would build the FIRST
  web-side `EventSource` consumer (none exists today). The primitive has real,
  leverage-bearing decisions — reconnection/backoff with NO `Last-Event-ID` (the spine
  sends no `id:` field, `sse.routes.ts:98`), auth on the public `live` topic, React
  StrictMode double-mount + cleanup, reusable-hook vs page-local — and MULTIPLE siblings
  consume it (`notify-me`, `playout-admin-redesign-live-data`). That makes the client
  primitive a grounded research *input*, not a gut call. Spun out as the `[research]`
  item `live-state-sse-client-pattern`; this feature's **client half** depends on it.

## Status: split into server-now / client-after-research

- **Server half** (proceed now, no research needed): derive a `liveState` tri-state
  (`live-creator` / `scheduled-playout` / `offline`) in the channel-list response from
  SRS session + `getAiringSource()` + channel role; fix the LIVE-badge semantics so the
  badge actually fires (replace the interim identity proxy at `live.tsx:157-161`); honest
  On-Air/Scheduled indicators + channel-type in the native `<select>`.
- **Client half** (after research): consume the SSE spine for live updates + visible
  takeover transitions + **re-fetch-refreshed** viewer count, built on the researched
  SSE-client primitive. Depends on `live-state-sse-client-pattern`.

  **Correction (2026-06-15, post-research cross-check):** the epic's event-needs list and
  the earlier draft assumed *spine-fed (push)* viewer count, but **the spine publishes no
  `channel.viewer-count` event** — `bold-event-spine-publishers` explicitly **deferred** it
  (`bold-event-spine-publishers.md:61`: SRS has no viewer-count push mechanism; it is
  poll-only). `viewerCount` lives only in the channel-list response. This is *absorbed* by
  the research's re-fetch model at zero extra cost: viewer count rides the same authoritative
  re-fetch the client already runs on every `spine.connected` and on `channel.live-state-
  changed`. So the client gets near-live viewer counts via the existing re-sync, NOT a push
  event. A true push `channel.viewer-count` (requiring an SRS poll→publish loop server-side)
  is a separate future spine addition, out of this feature's scope.

Design for the server half is written below; the client half is deferred to a follow-up
design pass once the research lands. Feature stays at `stage: drafting` until then —
NOT advanced to implementing, because its full design isn't settled.

## Server half — IMPLEMENTED (2026-06-15)

Built + verified end-to-end against the live SRS/Liquidsoap stack.

- **Unit 1** — `CHANNEL_LIVE_STATES` enum + `ChannelLiveState` type + `liveState` field on
  `ChannelSchema` (`packages/shared/src/streaming.ts`).
- **Unit 2** — `deriveLiveState(role, hasActiveSrsSession, isAiring)` in `srs.ts`, wired into
  the channel enrichment map. `live-creator` for a keyed-in `live-ingest` stream (presence in
  `srsViewerCounts`, populated only for `publish.active`) OR a broadcast takeover
  (`getAiringSource() === "live"`); `scheduled-playout` when airing; `offline` otherwise.
  The result type (`ChannelListResult`) carries `liveState`.
- **Boundary fix discovered in verification** — `streaming.routes.ts:/status` re-maps the
  channel response field-by-field (a hand-maintained boundary), so the new field was silently
  dropped despite passing the service-layer tsc. Added `liveState: ch.liveState` there. (Note
  for the codebase: this explicit re-map is a single-source-of-truth seam worth watching — it
  drops any new channel field by default; see `api-source-of-truth` position.)
- **Unit 3** — `live.tsx` now derives `selectedChannelIsLive` from `liveState === "live-creator"`
  (deleted the interim identity proxy + its `TODO(live-state)`). `StreamStatusBar` renders an
  honest tri-state: LIVE badge for `live-creator`, a muted "Scheduled" for `scheduled-playout`.
  Channel `<select>` options show the state label via `LIVE_STATE_LABELS`.

**Verification**: shared 675 / api 1610 / web 1737 unit (= baseline); tsc clean (shared/api/web).
Live stack: `/api/streaming/status` derives correctly (S/NC TV airing → `scheduled-playout`,
idle playout → `offline`, S/NC Music airing → `scheduled-playout`); `/live` SSR renders the
state labels + Scheduled indicator. Stale `live.test.tsx` `liveOverrides` fixture updated to
set `liveState` (was relying on the now-deleted identity proxy).

## Client half — STILL PENDING (design pass on the SSE position)
Live SSE updates + visible takeover transitions + re-fetch-refreshed viewer count, built on
`<SpineProvider>` per `.research/analysis/positions/sse-client-pattern.md`. Not yet designed —
this feature stays at `drafting` until the client half is designed + built.

## Server-half design (proceeds now; needs no research)

### Architectural choice
Derive `liveState` as a **computed field on the channel-list response**, not a stored
column (consistent with `unified-channel-model`'s "airing-state is derived, not stored",
`streaming.schema.ts:124`). The single derivation site is `srs.ts` (`getChannelList`),
which already fuses SRS session data + Liquidsoap now-playing + channel role — exactly the
inputs live-state needs. Rejected: a separate `/api/streaming/live-state` endpoint (splits
the SSOT the channel list already is) and a stored column (the unified-channel-model
position rejects it; ephemeral engine state doesn't belong in the row).

### Unit 1: `liveState` tri-state in the shared schema
**File**: `packages/shared/src/streaming.ts`
Add to `ChannelSchema` (after `nowPlaying`):
```ts
liveState: z.enum(["live-creator", "scheduled-playout", "offline"]),
```
Export `CHANNEL_LIVE_STATES` const + `ChannelLiveState` type for reuse.
**Acceptance**: `ChannelListResponse` carries `liveState` on every channel; type derives.

### Unit 2: server-side derivation
**File**: `apps/api/src/services/srs.ts` (in the per-channel enrichment map, ~`:108-149`)
Derivation rules (compute per channel):
- `live-ingest` role **with an active SRS session** (creator keyed in) → `live-creator`.
- `playout` role currently airing (has `nowPlaying`) → `scheduled-playout`.
- `broadcast` role (S/NC TV): consult `getAiringSource()` — `live` → `live-creator`
  (a creator took over the broadcast via Liquidsoap, bypassing per-channel SRS);
  `queue`/`fallback` with `nowPlaying` → `scheduled-playout`; else → `offline`.
- anything not airing → `offline`.
**Implementation notes**: the broadcast/`getAiringSource()` branch is the load-bearing
one — it's the takeover-bypass case the epic's design decision called out (SRS-only would
miss it). `getAiringSource()` returns `"unknown"` until the first Liquidsoap switch event
after API boot; treat `unknown` as `scheduled-playout` if `nowPlaying` present, else
`offline` (don't surface "unknown" to viewers).
**Acceptance**: a keyed-in creator channel reports `live-creator`; an airing playout
channel reports `scheduled-playout`; a broadcast channel mid-creator-takeover reports
`live-creator` even though no per-channel SRS session exists; idle → `offline`.

### Unit 3: client honest-indicator wiring (no SSE yet — reads the derived field)
**File**: `apps/web/src/routes/live.tsx`
- Replace the interim proxy at `:157-161`:
  ```ts
  const selectedChannelIsLive = selectedChannel?.liveState === "live-creator";
  ```
  (deletes the `TODO(live-state)` and the `ownership === "creator" && role ===
  "live-ingest"` heuristic — the documented bug).
- Render a state indicator from `selectedChannel.liveState`: a LIVE badge that actually
  fires for `live-creator`, an "On Air"/"Scheduled" label for `scheduled-playout`, honest
  offline copy for `offline`.
- Channel-type indication in the native `<select>` option labels (keep the `<select>` —
  richer picker deferred per audit).
This unit reads `liveState` from the channel-list response on load / poll-fallback — it
does NOT yet do live SSE updates (that's the client half, post-research). So the badge is
correct on every fetch even before the SSE consumer lands.
**Acceptance**: the LIVE badge fires for a `live-creator` channel and never for a
non-live one (the original semantics bug is gone); playout shows On-Air/Scheduled; the
`<select>` indicates channel type.

### Server-half implementation order
1. Unit 1 (schema) → 2. Unit 2 (derivation) → 3. Unit 3 (client read + indicators).
Single-stride; spawn as one server-half story once unblocked-design is settled, OR
implement inline (small, cohesive). No child stories spawned yet — the feature isn't
advanced.

### Testing
- Unit 2: `apps/api/tests/services/srs.test.ts` — table of (role, SRS session,
  getAiringSource, nowPlaying) → expected `liveState`, covering the takeover-bypass case.
- Unit 3: `apps/web` component test — badge fires iff `liveState === "live-creator"`.
- Live-stack: the dev SRS/Liquidsoap can drive a real keyed creator + a broadcast
  takeover to confirm the derivation end-to-end.

## Risks
- **`getAiringSource()` is process-ephemeral** (`playout-live-state.ts` — resets to
  `unknown` on API restart). The `unknown`-handling rule above prevents a wrong viewer
  signal, but a freshly-restarted API mid-broadcast-takeover would under-report until the
  next Liquidsoap switch event. The feature body's own brief flags heartbeat-polling from
  Liquidsoap as a possible mitigation — out of scope for the server half; note it for the
  client half / a follow-up if it bites.
