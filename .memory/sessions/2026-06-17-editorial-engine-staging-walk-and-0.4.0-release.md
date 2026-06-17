---
date: 2026-06-17
tags: [streaming, playout, liquidsoap, editorial-engine, staging, release, review]
session_type: operator-gate clearing → editorial staging walk → 0.4.0 release cut → review-queue closure
related_items:
  - unified-channel-model-editorial-engine
  - research-handoff-liquidsoap-version-capability-audit-1
  - release-0.4.0
  - idea-livestate-offline-while-streaming
---

# Session: editorial-engine staging walk + 0.4.0 release cut

Picked up from the editorial-engine implementation session (held at `review` pending one operator gate:
the end-to-end staging walk). This session **cleared the operator gates**, discharged the staging walk
against a live pipeline, cut the **0.4.0 release**, and **emptied the review queue**.

## 1. Liquidsoap 2.4.5 rebuild landed (was code-only, now running)
The v2.4.5 Dockerfile pin had been committed but never built — the running container was still **2.4.2**
(8 weeks old). Rebuilt `--no-cache`, recreated: `liquidsoap --version` → **2.4.5**, healthy, `.liq`
typechecked + evaluated clean, all harbor endpoints registered, S3 fetch + playout resumed, `awscli`/`curl`
apt layer rebuilt correctly. The editorial staging walk then ran against this 2.4.5 pipeline (v2.4.5 soft-dep).

## 2. Editorial-engine staging walk — every runtime verb verified on the live pipeline
The held gate. Drove a **throwaway service-layer script** (`apps/api/src/scripts/editorial-walk.ts`, deleted
after) against the live dev DB + LS harbor — there's no config-creation route yet (deferred to
playout-admin-redesign/creator-enablement), so it seeded config directly via `upsertEditorialConfig`/
`createEditorialTier`. Subject: **S/NC Music** (`228067cf-…`, platform-owned, real 3-row `channel_content` pool).

Verified (the gate B1/B2/I2 unit tests + `--check` structurally cannot see):
- **render-with-config** — all 5 editorial constructs present (pool `request.dynamic`, `/pool/next` URL,
  `_queue_program = fallback(track_sensitive=true,…)`, `_armed` ref, `switch.selected()`).
- **pool LRP rotation** — 4 draws → 3 distinct real Garage URIs round-robin then wrap; `lastPlayedAt`
  advances, `playCount` increments, order re-sorts. Pool auto-fill works.
- **manual-pin + auto-flip** — regenerate-restart (RestartCount 1→2), engine healthy each time, channel
  `gets up from switch.9` with proper content type — **no `mksafe(blank())` silence** (B2 fix held).
- **arm + take** — **live harbor mutation, StartedAt unchanged** → the central B1-downgrade claim confirmed
  (arm/take live; mode/manual regenerate-restart). `take` while already auto correctly skipped the restart.
- Clean teardown + revert (RestartCount 3, default render, 0 errors steady-state).

**Operator visually confirmed video renders** in a player off the 2.4.5 pipeline (HLS flowing for every
channel via SRS). That discharged both the editorial gate and the LS-2.4.5 step-2 visual check.

### Runtime finding (recorded, not a bug)
Each **regenerate-restart causes a ~10–30s per-channel RTMP output gap** — the kill-and-reconnect races SRS
releasing the prior publish session (`Avutil.Error(Input/output error)`, retries every 2s, connects when SRS
frees the stream name). **0 such errors at the clean 2.4.5 boot before config**, so it's inherent to
regenerate-restart, not the editorial topology. Implication: structural editorial verbs are NOT gapless;
worth a UI affordance when the editorial UI lands. Aligns with the epic's "regenerate-restart now,
runtime-detach later" CRUD decision.

## 3. Real bug surfaced + parked: `idea-livestate-offline-while-streaming`
The operator saw S/NC Classics + test channels show **"Offline"** while SRS was provably serving their HLS.
Root cause: `srs.ts deriveLiveState` for playout channels computes `isAiring = (nowPlaying !== null)`, and
`nowPlaying` comes ONLY from `playout_queue` having a `playing` item. Channels airing from the
pool/`channel_content` LRP or the static default render have 0 queue playing-items → "offline" despite live
HLS. **Pre-existing** (predates the editorial model) but the editorial model **sharpens** it (pool-fed auto
channels are first-class). Fix direction: broaden playout `isAiring` to reflect pool/auto airing and/or SRS
publish presence (`hasActiveSrsSession` is already computed but only consumed for live-ingest/broadcast).
Not a blocker — separate UI status layer, not the editorial runtime mechanism. Parked to backlog.

## 4. Cut release 0.4.0 + emptied the review queue
- **Created `release-0.4.0`** (Unified Channel Model + Editorial Engine), `stage: planned`. **Note:** the
  release-kind valid stages are `{planned, quality-gate, released}` — NOT `scoping` (the validator rejected
  it; "scoping unit" is conceptual prose, not the stage value).
- **16 items bound to 0.4.0**, all `done`: unified-channel-model epic (editorial-engine ×6 + identity-lifecycle
  ×5, bound together per `epic_cohesion: total`), the LS research feature + upgrade story, and the 3
  prod-verify stories. Deliberately **left unbound**: `bold-*` epics, `standalone-devcontainer`, refactor/infra
  stragglers — separate arcs for a dedicated scoping pass, not a blanket sweep.
- **3 review-held items advanced `review → done`** (on-forward-session-first-classifier, systemd-graceful-exit,
  failed-upload-blocks-retry). These were stuck only on prod/staging verification, and **there is no
  'held'/'prod-verify' story stage**. Convention puts prod-only verification in the release's
  `## Prod verification` walk **after** `released`, not the review stage — so they close to `done` with their
  prod checks relocated to `release-0.4.0.md §Prod verification`. `failed-upload-blocks-retry` flagged as the
  weakest (actually dev-reproducible, just deferred; re-open if the release walk regresses).
- **Review queue is now empty.**

## 5. Settled positions / process learnings
- **Staging walk earns its keep — again.** It confirmed the B1-downgrade behavior end-to-end (arm/take live,
  mode/manual restart) AND surfaced two things unit tests can't: the regenerate-restart output gap (real
  operational characteristic) and the Offline-while-streaming status bug (via close observation).
- **Prod-only verification belongs to the release walk, not the review stage.** When a fix is code-verified
  but its last check needs an environment we don't have (prod systemd, real Twitch/YouTube, prod creds),
  advancing to `done` with the check in `release-0.4.0.md §Prod verification` is convention-correct — the
  fix-verify loopback's "confirm in the running app" is satisfied at ship time. Don't strand items at `review`.
- **Release stage vocab is fixed** (`planned/quality-gate/released`); per-kind stage validation lives in the
  plugin's `substrate-maintainer.py` `VALID_STAGE` map.
- **The sandbox carve-out** (`.claude/settings.local.json`, gitignored) was missing on this machine — created
  it (subprocess `.env` read + `allowLocalBinding`) so the walk script could reach DB/LS. Also note: the dev
  services are **directly reachable** from the agent sandbox here (postgres:5432, LS:8888 on `0.0.0.0`) — the
  sandbox-forwarder failed to bind because the ports were already taken by the real services, so it wasn't
  needed. This environment is NOT netns-isolated the way `sandbox-test-integration.sh` assumes.

## 6. State + pending
- **0.4.0 holds 16 `done` items, stage `planned`** — ready for `release-deploy` when the operator ships
  (quality gates run then). `tsc` + 1762 unit tests + `liquidsoap --check` green.
- **Pushed to `forgejo/main` + submodule pointer bumped this session** (3 commits: park, close, bind).
- **Outstanding operator-at-station** (now tracked in 0.4.0 §Prod verification, not review): LS-2.4.5 prod
  ship-and-watch, on-forward simulcast go-live, systemd restart, upload-retry behavioral check.
- **Next moves:** `snctv-composition` (re-express S/NC TV on the engine — the output-equivalence gate, next
  unified-channel-model child); the `bold-*` + straggler release-scoping pass; eventually `release-deploy` 0.4.0.
