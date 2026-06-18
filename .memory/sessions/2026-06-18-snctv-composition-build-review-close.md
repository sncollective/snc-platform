---
date: 2026-06-18
tags: [streaming, playout, editorial-engine, snctv, implement, review, fix]
session_type: snctv-composition implement → feature deep review (2 blockers) → fix → re-review → staged walk → close
related_items:
  - unified-channel-model-snctv-composition
  - unified-channel-model
---

# Session: snctv-composition — build, deep review, fix, close to done

Implemented `unified-channel-model-snctv-composition` (the editorial engine's first real consumer:
S/NC TV re-expressed as an ordinary editorial-config channel), ran it through a fresh-context deep
feature review that caught **two real production-path blockers**, fixed and re-reviewed both, drove
the machine-checkable staging walk, and closed the feature + 4 stories to `done`. 11 commits
(`ff65ca2` → `4504d1b`).

## 1. Implementation (orchestrator, inline, 4-story chain)
Drove the chain inline (operator's choice — held the full editorial-engine context from the design
pass). Chain: `broadcast-render` → `topology` (the equivalence gate) → {`seed-config`,
`nowplaying-consumer`}.

- **broadcast-render**: the render learned broadcast-role affordances — `:1936` `input.rtmp` live
  tier (role-conditioned; I2 deferral holds elsewhere), `fallback(transitions=[notify_switch…])`
  telemetry (rides on `fallback`'s transitions param, names pinned to the input-switch route's strict
  enum), role-branched `renderChannelBlock`.
- **topology**: broadcast channel joined the generated topology (`inArray(role,
  ["playout","broadcast"])`); static `.liq` tail + dead `broadcast`/`sncTvStream` fields deleted;
  `docs/streaming.md` rolled forward. Render golden diff reviewed byte-equivalent on the fallback;
  `liquidsoap --check` clean.
- **nowplaying-consumer**: `getNowPlaying` repointed off the retired legacy `/now-playing` onto the
  broadcast channel's per-channel path (resolves the channel itself; no-arg signature kept).
- **seed-config**: surfaced a real engine design conflict mid-grounding (live-XOR-carry constraint vs
  S/NC TV needing both) → bounced to drafting → operator chose the broadcast-role exemption → folded
  in + seeded the 3-tier config.

## 2. Fresh-context deep feature review — 2 blockers (the load-bearing event)
A fresh reviewer (no investment in the impl) caught two regressions the snapshot golden
(structure-only) and the dev-DB happy-path check were blind to. **I'd rationalized both past.**

- **BLOCKER 1**: broadcast now-playing `uri`/`title` went blank whenever S/NC TV aired the **carried
  Classics** (the steady state) — the new `on_metadata` attached to the broadcast's own queue, not
  the aired fallback source. The OLD static block attached it to the whole fallback. Broke the
  viewer now-playing title + the item correlation in `playout.ts`.
- **BLOCKER 2**: the editorial-config backfill was operator-manual only. Boot regenerates the `.liq`
  (`writeConfigOnly`) but never seeded — so an existing deployment restarting before a manual reseed
  rendered the broadcast channel config-less (queue-only), silently dropping the `:1936` live input +
  Classics carry. The "verified live against dev DB" check passed only because I'd *just* run the
  seed manually; it never exercised restart-without-reseed.

Verdict: Request changes. topology + nowplaying-consumer reviewed clean; filed 2 doc backlog items.

## 3. The fixes
- **BLOCKER 1** (`36535c5`): broadcast-only `${vid}_source.on_metadata` writes the now-playing refs
  from whatever airs (restores the old whole-fallback behavior, byte-equivalent); queue webhook is
  track-event-only (no double-source); also removed the inert broadcast `_armed` ref + `/arm`
  endpoint (the broadcast fallback never reads `_armed`). +3 regression tests proven to fail without
  the fix.
- **BLOCKER 2** (`31ff2cf`): new idempotent `ensureBroadcastEditorialConfig()` (self-contained —
  resolves broadcast + carry target from the DB), called at boot **before** `writeConfigOnly()`;
  branches no-op/complete-skip/zero-backfill/partial-warn; failure-safe (never blocks boot). Seed
  refactored to the shared function. Verified the restart-without-reseed scenario live: deleted the
  config → boot path backfilled `live/queue/carry`, idempotent.

## 4. Re-review + staging walk
- **Fresh-context re-review**: both blockers **RESOLVED**, no new problems. Confirmed the Liquidsoap
  metadata-propagation assumption (the old prod block relied on the identical `fallback.on_metadata`
  pattern; `.selected()` covers the silent-re-selection edge). One actionable note (backfill
  happy-path lacked a unit test) handled honestly — a brittle mock proved gaming-adjacent, so
  documented the live verification as coverage instead (`eedc8ca`).
- **Staging walk** (machine-checkable parts, throwaway service-layer script vs the live dev pipeline):
  PASS on config/render equivalence, broadcast now-playing harbor shape, and the **input-switch
  telemetry round-trip (all 4 sources → 200)** — the live-state spine works end-to-end. Could NOT
  verify the carry-source *metadata propagation* at runtime (dev Classics airs `mksafe(blank())` — no
  seeded media, so nothing for `on_metadata` to report) or real-RTMP takeover/simulcast — those are
  operator-at-station.

## 5. Close-out
Feature + 4 stories → `done`, archived as bodyless stubs (`delete-refs`, `archived_atop: 0.3.0`).
Operator staged-walk checklist (content-airing now-playing, creator takeover/fall-back, viewer +
simulcast, transition-firing) filed as `snctv-composition-operator-staged-walk` for the release
Prod-verification (editorial-engine precedent). Parent epic `unified-channel-model` stays
`implementing` — `creator-enablement` (its last child) is still `drafting`.

## Settled positions / process learnings
- **Fresh-context feature review earns its keep — again.** Same lesson the editorial engine taught
  (2026-06-17): green unit tests + a structural golden don't catch metadata-propagation or
  provisioning regressions. Both blockers were things the author rationalized past; only a reviewer
  with no investment caught them. Run one before a feature on the streaming path closes.
- **"Verified live" can lie if it doesn't exercise the hazard path.** The BLOCKER-2 dev-DB check
  passed because the seed had just run manually — it validated the happy path, not the
  restart-without-reseed deployment hazard. A live check is only as strong as the scenario it
  actually reproduces.
- **Don't keep a brittle test to satisfy a coverage note.** When the backfill happy-path unit test
  broke on mock-call ordering rather than real regressions, documenting the live verification was
  more honest than a green test that lies. (Per `agent-discipline` test-integrity.)
- **Broadcast is the one designed live+carry exception.** The editorial engine's live-XOR-carry
  constraint is right for playout channels; the broadcast role is exempt because S/NC TV is the
  channel the unified model built to hold both. Recorded in `validateOwnershipConstraint`'s JSDoc.

## State + pending
- **snctv-composition done**; full API suite **1778** + `tsc` + `liquidsoap --check` green.
- **Review queue**: only `calendar-event-patch-drops-visibility` (held on user in-app fix-verify).
- **Backlog (filed this arc)**: `snctv-composition-operator-staged-walk`, `snctv-stale-nowplaying-comment`,
  `streaming-doc-audio-bitrate`.
- **Next epic child**: `unified-channel-model-creator-enablement` (drafting) — the last
  unified-channel-model feature.
- **Not mine, uncommitted**: `AGENTS.md` (the in-progress Codex-support change), left untouched across
  all commits this session.
