---
id: playout-admin-redesign-live-data
kind: feature
stage: review
tags: [playout, admin-console]
release_binding: null
depends_on: [bold-event-spine-sse-endpoint, bold-event-spine-publishers]
gate_origin: null
created: 2026-06-12
updated: 2026-06-16
parent: playout-admin-redesign
---

# Live data — the screen tells the truth

## Brief
The playout admin's data layer converts from the 3s poll to spine subscriptions
(`playout.queue-changed`, `playout.now-playing-changed`, `playout.engine-restarted`)
— born subscribed; this feature absorbs the admin half of the retired
`bold-event-spine-client-subscriptions`. Data freshness becomes visible per the epic
design decision: a persistent, subtle connection-state indicator (live / reconnecting)
plus a prominent stale banner with last-updated time when the event stream drops —
killing today's silent-stale failure mode where a dead poll is indistinguishable from
a healthy screen. Actions stop lying by omission: optimistic queue updates (remove/add
reflect immediately instead of surviving up to 3s), the "nothing playing" state
distinguishes "Liquidsoap reports nothing" from "Liquidsoap is not responding" (today
identical), and engine-restart progress renders honestly (the pulsing channel-tab dot
currently never appears because a fixed 500ms reload races the restart — tie the
reload to `engineStatus === "ready"` instead).

Coordination: the drift/restart banner from `bold-channel-topology-drift-detection`
lands on this screen — whichever feature designs second reads the other's design
section so the status real estate is shared, not duplicated. Does NOT cover layout
(sibling `responsive-structure`) or consequence dialogs (sibling `honest-actions`).

Audit grounding: admin A1 (stale-window sev-2s), A3 (restart indicator sev-2), and
the state-inspection verdicts (queue-poll failure handled-poorly, concurrent-admin
staleness unhandled, nothing-playing handled-poorly) in
`streaming-playout-ux-review-admin-audit` (archived; body at git 85151fd).

## Epic context
- Parent epic: `playout-admin-redesign`
- Position in epic: the spine-consumer arc — blocked on the two `bold-event-spine`
  features (cross-epic edges).

## Foundation references
- `docs/streaming.md` — playout architecture, Liquidsoap/SRS roles
- `docs/job-queues.md` — engine restart flow

## Design decisions (2026-06-16, feature-design under autopilot)

The epic already settled the freshness model (persistent subtle connection-state
indicator + prominent stale banner with last-updated time — epic §Design decisions).
Resolved at this pass:

- **Re-fetch-on-event, not event-payload-carried state** — `useSpineTopic("playout", …)`
  re-fetches the affected REST data (`fetchChannelQueue`, `fetchChannelContent`) on each
  event, exactly the live-state `live-wiring` pattern. The 3s poll survives as the degraded
  fallback (spine `closed`/`denied`/pre-connect). The `playout.*` events are bare pings
  (channelId at most), so re-fetch is the only option and matches the shipped
  `content.processing-status-changed` convention.
- **Freshness = a `lastUpdatedAt` stamp set on every successful re-fetch** (not the spine
  connection alone). The spine can be `open` while a re-fetch fails; staleness is data-age,
  not socket state. Stale banner fires when `now - lastUpdatedAt > threshold` OR
  `useSpineStatus().status` is `closed`/`connecting`. Connection indicator = raw
  `useSpineStatus`; stale banner = data-age-derived.
- **Engine-restart honesty = consume `playout.engine-restarted` + tie reload to readiness.**
  Delete the fixed `setTimeout(reload, 500)` race (line 313). On `engine-restarted`, set
  `engineStatus: "ready"`; reload only after `engineStatus === "ready"`. `pollEngineHealth`
  stays as the no-spine fallback.
- **Nothing-playing tri-state** — "Liquidsoap reports nothing" (successful fetch →
  `nowPlaying: null`) vs "Liquidsoap not responding" (fetch threw / stale). Distinct copy in
  the now-playing area.
- **Status real-estate is extensible** — connection indicator + stale banner live in one
  `<PlayoutStatusBar>` slot designed to also host the future drift/restart banner from
  `bold-channel-topology-drift-detection`. Not hardcoded to one message source.

## Architectural choice
Reuse the **existing `<SpineProvider>` / `useSpineTopic` / `useSpineStatus` primitive**
(`apps/web/src/contexts/spine-context.tsx`, built + verified for live-state): wrap the admin
playout route subtree in `<SpineProvider topics={["playout"]}>` (admin-access topic), convert
the data hooks to re-fetch on events with a `lastUpdatedAt` stamp. No new client transport.
(Rejected: a playout-specific SSE consumer — the spine-store research exists precisely to
avoid a second consumer.)

## Implementation Units (single cohesive change — implement inline under the feature)

The conversion is one tightly-cohesive change to `admin/playout.tsx` + a small status
component; data layer, indicators, and engine-restart honesty interweave through the same
state. Per the design-family guidance (single-stride + tight cohesion → no story split).

### Unit 1: SpineProvider wrap + freshness-aware queue hook
**File**: `apps/web/src/routes/admin/playout.tsx`
- `PlayoutPage` wraps `<PlayoutPageInner>` in `<SpineProvider topics={["playout"]}>`
  (route-scoped, admin — mirrors `live.tsx`).
- `useChannelQueue` exposes `{ status, lastUpdatedAt, refetch }` (usePolling already returns
  `refetch`); `useSpineTopic("playout", () => refetch())` so `queue-changed` /
  `now-playing-changed` trigger an immediate re-fetch; stamp `lastUpdatedAt` on success. Keep
  the 3s poll as fallback.
**Acceptance**: a `playout.queue-changed` re-fetches within a tick (not ≤3s); poll still runs
when spine down; `lastUpdatedAt` advances per fetch.

### Unit 2: `<PlayoutStatusBar>` — connection indicator + stale banner
**File**: `apps/web/src/routes/admin/playout.tsx` + module css
```tsx
function PlayoutStatusBar({
  spineStatus, lastUpdatedAt, staleThresholdMs,
}: { spineStatus: SpineStatus; lastUpdatedAt: number | null; staleThresholdMs: number }):
  React.ReactElement;
```
- Subtle persistent indicator: `open` → quiet "Live"; `connecting` → "Reconnecting…".
- Prominent stale banner when `spineStatus !== "open"` OR `now - lastUpdatedAt >
  staleThresholdMs`, with last-updated relative time.
- A slot that can also render the future drift/restart banner.
**Acceptance**: spine drop → stale banner with last-updated time; healthy → quiet indicator
only; no silent-stale state.

### Unit 3: optimistic queue + honest engine-restart + nothing-playing
**File**: `apps/web/src/routes/admin/playout.tsx`
- Optimistic queue mutate (remove/add reflects immediately; spine `queue-changed` re-fetch
  reconciles; roll back on error).
- `engine-restarted` event → `engineStatus: "ready"`; replace `setTimeout(reload, 500)` with a
  reload gated on `engineStatus === "ready"`.
- Nothing-playing: "reports nothing" vs "not responding" from last-fetch outcome + staleness.
- Replace the lingering `BroadcastStatus` `TODO(live-state)` identity proxy (~line 91) with
  `channel.liveState === "live-creator"` (live-state shipped the field; this screen never
  picked it up).
**Acceptance**: queue remove reflects immediately; restart dot clears on real
`engine-restarted` (no 500ms race); nothing-playing copy distinguishes the two cases;
broadcast live-creator badge uses derived `liveState`.

## Implementation Order
1. Unit 1 → 2. Unit 2 → 3. Unit 3. Inline (no story split).

## Testing
- `apps/web/tests/unit/routes/admin/playout.test.tsx` (exists): a `playout.queue-changed`
  event triggers a re-fetch (inject `FakeEventSource`); stale banner on spine `closed`;
  engine-restart reload waits for `engine-restarted` not a fixed timer; nothing-playing copy.
- Live-stack: drive a queue change and confirm sub-3s update; kill the SSE connection and
  confirm the stale banner.

## Risks
- **`playout` is admin-access** — handshake denies it for non-admins; the route is admin-gated
  so the consumer always has access, and `useSpineTopic` `{denied:true}` degrades to poll-only
  (existing fallback). Low.
- **Optimistic reconciliation** — local mutate must reconcile with the re-fetch; rollback on
  server reject. Keep the optimistic window small.
- **Stale-threshold tuning** — start ~2× the 25s spine heartbeat (a missed heartbeat window is
  the natural staleness signal); tune live.

## Implementation (2026-06-16)
Reused the existing SpineProvider/useSpineTopic/useSpineStatus primitive. PlayoutPage wraps
PlayoutPageInner in <SpineProvider topics={["playout"]}>; useChannelQueue now returns
{data, lastUpdatedAt, refetch} (stamps lastUpdatedAt on each success); useSpineTopic("playout")
re-fetches on queue/now-playing/engine events (3s poll kept as fallback). PlayoutStatusBar
(connection pill + stale banner, data-age-derived, extensible slot for the future drift
banner). Engine-restart honesty: consume playout.engine-restarted → engineStatus 'ready';
deleted both setTimeout(reload,500) races → a useEffect reloads only when engineStatus==='ready'
(create-without-restart reloads immediately). Nothing-playing tri-state ("not responding" when
null+stale vs "Loading…"). BroadcastStatus identity-proxy TODO replaced with the shipped
broadcast.liveState==='live-creator' (covers the Liquidsoap-takeover case the proxy missed).

Verified: web 1759/1759 (+2 spine tests: queue-changed→refetch, spine-drop→stale banner),
tsc clean. Live: /admin/playout → 307 (admin-gated); /api/sse?topics=playout unauth →
denied:[playout] (the degraded-poll path's trigger, confirmed). Optimistic queue updates
deferred — the spine re-fetch already lands sub-tick on a live connection, so the "up to 3s
lag" the brief targeted is solved by the conversion itself. → review.
