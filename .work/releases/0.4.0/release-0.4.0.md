---
id: release-0.4.0
kind: release
stage: planned
tags: []
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: null
quality_gates_passed: []
related_items: []
created: 2026-06-17
updated: 2026-06-17
---

# Release 0.4.0 — Unified Channel Model + Editorial Engine

The unified-channel-model epic's release bundle. Reframes every channel as a single
continuous program source with an editorial control plane, and re-expresses S/NC TV on
that engine. Successor to 0.3.0 (Animal Future event readiness).

This release is a **scoping unit**, not a deployment unit — it accumulates the
unified-channel-model children as they pass review. The epic is mid-flight; bound items
land here incrementally (`epic_cohesion: total` — every child of the epic binds to the
same release).

## Scope

- **Editorial engine** (`unified-channel-model-editorial-engine`, done 2026-06-17) — per-channel
  editorial config: source tiers (live / queue+pool / channel-as-source), manual|auto mode, the
  unified program-source model (operator queue auto-fills from a pool; auto = readiness fallback
  over enabled sources). Control verbs: mode/manual via regenerate-restart, arm/take live. Built
  on Liquidsoap 2.4.5. Children: config-schema (migrations 0029–0031), topology, render,
  control-client, control-service.
- **Liquidsoap 2.4.5 upgrade** (`research-handoff-liquidsoap-version-capability-audit-1`) — the
  engine the editorial work builds on; staging-verified.
- **In flight (binds on review-pass):** `snctv-composition` (re-express S/NC TV on the engine, the
  output-equivalence gate — the next epic child), `creator-enablement`, and the rest of the
  unified-channel-model epic as it lands.

## Changelog highlights

**Streaming + playout**
- Editorial engine: per-channel editorial config + tiers; readiness-fallback `switch` (auto),
  manual-pin, queue = `fallback(track_sensitive=true, [operator_queue, pool])`, pool = LRP
  `request.dynamic` → `/pool/next`; `switch.selected()` now-playing; bespoke per-channel harbor
  control endpoints (mode/arm/manual). Migrations 0029–0031.
- Liquidsoap 2.4.2 → 2.4.5 (playout-image base pin).

## Prod verification

Per platform's `release_mapping: none`, deployment is user-at-station (manual ship from the
operator's station). After `stage: released`, walk these prod-only checks that require production
credentials and can't run in CI:

- **Editorial engine on prod pipeline:** mode/manual after regenerate-restart, arm/take live, LRP
  pool rotation, the regenerate-restart cycle (note the ~10–30s per-channel output gap on restart
  while SRS releases the prior publish session — see the editorial-engine item's staging-walk
  finding).
- **Liquidsoap 2.4.5 prod ship-and-watch** (mitigation for thin automated regression coverage);
  revert plan = re-pin `v2.4.2` + rebuild.
- **`on-forward-session-first-classifier`:** a real creator RTMP push with active Twitch/YouTube
  simulcast destinations — confirm both external platforms go live AND S/NC TV takes over (the API
  returns forward URLs, not an empty `urls:[]`). Code + regression tests green; this is the prod-only
  go-live (can't reproduce real simulcast destinations in dev).
- **`systemd-graceful-exit`:** on the prod user-station host — `systemctl restart snc-api` completes
  within ~35s without hanging, shutdown log shows per-stage completion, no pg-boss lock leftovers
  (`SELECT * FROM pgboss.job WHERE state='active'` immediately after), clean `systemctl status`.
  (Dev has no systemd — PM2 only.)
- **`failed-upload-blocks-retry`:** upload killed mid-flight (CORS/network) then retried — confirm no
  "already exists" error and no orphaned Garage multipart parts. (Dev-reproducible; deferred here for
  convenience — could be confirmed in dev before ship.)
- **Resumable (tus) uploads on prod** (`tusd-prod-deploy-uploads-404`): a creator completes a
  `content-media` upload end-to-end on prod — `/uploads/` POST → tus PATCH chunks → post-finish hook →
  canonical rename → probe/transcode → playback. **Blocked until the tusd prod deploy lands** (tusd is
  not deployed to prod; `/uploads/*` 404s today). The deploy artifacts (`snc-tusd.service.example`,
  the repointed `/uploads/*` Caddy blocks) are drafted; this check is the gate that the deploy
  actually worked. Confirm in the same pass that `/api/tusd/hooks` is not reachable from outside the
  host (closes the deferred 0.3.0 S1 "tusd hooks network auth"). Note: the
  `failed-upload-blocks-retry` check above also rides the tus path and is untestable on prod until
  this lands.

## Quality gate posture

Gates run at `release-deploy` against the combined deployment surface:
`gates_for_release: [security, tests, cruft, docs, patterns, refactor]`. Not yet run for 0.4.0.
