---
date: 2026-06-15
tags: [streaming, research, orchestration, live-experience-redesign]
session_type: orchestrated refactor drain → SSE research engagement → live-state server half
related_items:
  - live-experience-redesign
  - live-experience-redesign-live-state
  - live-state-sse-client-pattern
  - sse-client-pattern (research position)
---

# Session: refactor drain (orchestrated) → SSE-client research → live-state server half

Long session, three arcs, all against the live dev stack. Continued from the e2e-drift /
refactor-debt work earlier the same day.

## Arc 1 — orchestrated refactor-debt drain (already noted separately, recap)

Drained the 6-item `[refactor]` cluster (2 inline, 4 via a worktree-isolated Workflow),
reviewed (deep-lane, 2 adversarial reviewers), archived as bodyless stubs. Every 2026-04-20
plan had drifted — the re-grounding was the value. The route-split agent self-blocked
correctly on a test-coupling gate; the authorized retry caught a latent Hono mount-order bug.

## Arc 2 — SSE-client research engagement (agentic-research orchestrator)

Designing `live-experience-redesign-live-state` surfaced that its **client half** needs the
first web-side `EventSource` consumer, and 3+ siblings consume it — a grounded research
*input*, not a gut call. Split the feature: server half (no research) + client half (gated).

Ran the full ARD walk via `agentic-research:research-orchestrator`, `standard` rigor:
- 3-facet campaign (transport / react-integration / testing), 18 source-direct attestations
  (WHATWG SSE spec, MDN, official React docs, jsdom/Vitest/RTL, named community sources).
- Verification: lint → adversarial-read (**APPROVED**, fresh-context opus, zero blockers,
  walked the load-bearing WHATWG claims back to source) → spot-check.
- **Position** (`.research/analysis/positions/sse-client-pattern.md`): native `EventSource`
  (no dep); one `<SpineProvider>` per tab via `useSyncExternalStore`; full REST re-sync on
  every `spine.connected` (no-`id:` → no replay); native auto-reconnect on the clean 4h
  close (no backoff timer; terminal-CLOSED → re-auth); inject `eventSourceCtor` +
  hand-rolled `FakeEventSource` for tests (jsdom lacks EventSource).
- Commissioning `[research]` item closed to `done` (`close-to-done`; verification ran inline).

**Cross-check that mattered:** after the research, re-checked it against the server design.
Caught one unfounded assumption — "spine-fed (push) viewer count." The spine **deliberately
deferred** `channel.viewer-count` (`bold-event-spine-publishers.md:61` — SRS is poll-only).
The research's re-fetch model absorbs it for free (viewer count rides the authoritative
re-fetch on every reconnect). Reframed push→re-fetch-refreshed; rest of the server design
validated. This is the payoff of researching the client before building the server.

## Arc 3 — live-state SERVER HALF (built + verified live)

The research-free half. Derived `liveState` tri-state (`live-creator` / `scheduled-playout`
/ `offline`) through the full stack + fixed the LIVE-badge semantics bug.
- shared: `CHANNEL_LIVE_STATES` + field on `ChannelSchema`.
- `srs.ts`: `deriveLiveState()` — handles the **broadcast-takeover-via-Liquidsoap** case
  (`getAiringSource() === "live"`) that SRS-only would miss (the epic's load-bearing edge).
- `live.tsx`: derive `isLive` from `liveState` (deleted the interim identity proxy + its
  `TODO(live-state)`); `StreamStatusBar` renders honest LIVE/Scheduled; select shows labels.

**Two boundary issues the LIVE STACK caught that tsc did NOT:**
1. `streaming.routes.ts:/status` **re-maps the channel response field-by-field**, silently
   dropping `liveState` at the HTTP boundary — service layer compiled fine; only the live
   probe showed `liveState: undefined`. A real SSOT seam (flagged in the item; see the
   `api-source-of-truth` position). Fixed by adding the field to the map.
2. `ChannelListResult` return type didn't include `liveState` (runtime had it, type didn't)
   — surfaced as a tsc error in the route only after #1 was fixed.
3. (test) A stale `live.test.tsx` `liveOverrides` fixture relied on the deleted identity
   proxy — repaired per test-integrity.

**Verification**: shared 675 / api 1610 / web 1737 (= baseline); tsc clean (3 pkgs); live
stack derives correctly (S/NC TV airing → scheduled-playout, idle → offline); `/live` renders
the indicators.

## Process note

A transient Claude-side API error interrupted the wrap-up turn (NOT the platform API, which
stayed healthy at 200 throughout — confirmed via pm2 + logs). Re-confirmed clean state and
resumed. Don't conflate "API error" alerts with the SNC platform unless the logs say so.

## Resume map

- live-experience-redesign epic: layout-ergonomics + page-states done; **live-state server
  half done**, client half pending; notify-me depends on live-state. Feature stays `drafting`.
- **Next: design the live-state CLIENT HALF** on the SSE position — build the `<SpineProvider>`
  (reused by notify-me + playout-admin-redesign-live-data), wire live updates + takeover
  transitions + re-fetch-refreshed viewer count into live.tsx. Then notify-me, then advance
  the epic.
- Commits this session pushed to `forgejo/main` (refactor cluster + SSE research + live-state
  server half + this note).
