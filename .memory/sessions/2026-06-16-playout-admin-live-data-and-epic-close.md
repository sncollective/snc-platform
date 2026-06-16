---
date: 2026-06-16
tags: [playout, admin-console, streaming, spine, epic-close, autopilot]
session_type: autopilot — live-data feature build → review → playout-admin epic close
related_items:
  - playout-admin-redesign
  - playout-admin-redesign-live-data
---

# Session: playout-admin live-data (spine conversion) → playout-admin-redesign epic close

Autopilot continuation. Picked the highest-value next arc that needed no judgment fork:
`playout-admin-redesign-live-data` — the last child of the playout-admin-redesign epic, and
a direct reuse of the `<SpineProvider>` primitive built earlier for live-state.

## Why this over the alternatives (the autopilot pick)

Two `implementing` epics each had one ready feature. `unified-channel-model-editorial-engine`
was deliberately NOT picked: its brief mandates the design pass open with a *no-restart
switching spike* (a named epic risk — Liquidsoap interactive-variables vs supervised
pipeline restart) — real feasibility research that needs deliberate design, not autopilot.
`playout-admin-redesign-live-data` was the clean pick: well-specified, freshness model already
settled at epic-design, mechanism settled (reuse the existing spine primitive), fully
agent-verifiable. Surfaced the editorial-engine spike to the user rather than auto-attempting it.

## What was built

A web-only conversion of `admin/playout.tsx`:
- `PlayoutPage` wraps `PlayoutPageInner` in `<SpineProvider topics={["playout"]}>` (admin
  topic) — reusing the primitive, not rebuilding (the spine-store research existed precisely
  to make this one consumer reusable).
- `useChannelQueue` → `{data, lastUpdatedAt, refetch}`; `useSpineTopic("playout")` re-fetches
  on queue/now-playing/engine events. 3s poll kept as the degraded fallback.
- `<PlayoutStatusBar>`: subtle connection pill + a prominent stale banner (data-age-derived,
  not socket-only). Designed as an extensible slot for the future drift banner.
- Engine-restart honesty: consume `playout.engine-restarted` → `engineStatus: "ready"`;
  deleted both `setTimeout(reload, 500)` races → a `useEffect` reloads only when ready.
- Nothing-playing tri-state ("not responding" vs "Loading…"); BroadcastStatus identity-proxy
  TODO replaced with the shipped `liveState` field.

## Adversarial review — APPROVED, but earned its keep

The review validated the riskiest piece (reload-gating, all paths correct) and answered the
crux question honestly: **does the stale banner actually appear when data silently ages?**
`Date.now()` in render isn't reactive — so the answer hinges on whether anything re-renders.
It does: the 3s fallback poll keeps `setState`-ing (even on failure), which is the re-render
clock that surfaces the banner. So kill-silent-stale holds — **but the 3s poll is load-bearing
for it, not merely a fallback** (recorded in the item: don't spine-gate the poll). Fixes
applied: removed a dead `useRef` import (nit), and added the **data-age staleness test** the
reviewer flagged as the one gap — it covers the feature's core claim (spine open + failing
re-fetches + fake-timer clock advance → banner). That test is the most valuable artifact here.

## Epic close

All 3 children done (responsive-structure + honest-actions from prior sessions, live-data this
session) + the two design-system primitives they depended on (responsive-table-card-pattern,
shared-confirm-dialog-component). Epic + 2 remaining features + 3 stories archived as bodyless
stubs (responsive-structure was already archived). The whole playout admin redesign shipped.

## Verification

web 1760/1760 (+3 spine/staleness tests); shared/api untouched; tsc clean. Live: /admin/playout
admin-gated (307); /api/sse?topics=playout for unauth → denied:[playout] (confirms the
degraded-poll trigger path).

## Resume map

- **playout-admin-redesign: DONE + archived.** Third epic closed in two days (live-experience,
  email-capture, playout-admin).
- The reusable `<SpineProvider>` now has TWO consumers (live page, playout admin) — the
  research leverage paid off.
- `unified-channel-model` remains: `editorial-engine` is next but is SPIKE-GATED (no-restart
  switching feasibility) — needs a real design pass, surfaced to the user as not-autopilot.
- bold-* epics remain design-gated.
- 3 done-but-held stories still await user fix-verify (failed-upload, on-forward, systemd).
