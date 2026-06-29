---
id: release-0.4.0
kind: release
stage: quality-gate
tags: []
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: null
quality_gates_passed: []
related_items: []
created: 2026-06-17
updated: 2026-06-29
---

# Release 0.4.0 — Post-0.3.0 Platform Sweep

The full unreleased surface since 0.3.0 shipped (2026-04-24). Four epics land here —
`unified-channel-model`, `machine-verifiable-testing`, `live-experience-redesign`, and
`playout-admin-redesign` — together with the `email-capture-at-shows` commerce feature and a
broad refactor / a11y / testing sweep across every surface.

This release is a **scoping unit, not a deployment unit** (`release_mapping: none`). With all
development on main and deployment user-at-station, every reviewed item is already on the deploy
surface — binding is tracking and changelog completeness, not code inclusion. The bundle is large
because the substrate accumulated ~2 months of done-but-never-bundled work during the 0.3.0 →
`delete-refs` migration (commit `2b46b70`, 2026-06-16): 87 archived stubs stamped `archived_atop:
0.3.0` were genuinely never released (0 of them appear in the 0.3.0 shipped bundle), and this
release claims them.

## Scope

Four epics define the narrative arcs; the rest is cross-cutting sweep work done atop the 0.3.0
baseline.

### Streaming + playout

- **Unified channel model** (`unified-channel-model`, done 2026-06-29) — reframes every channel as
  a single continuous program source with an editorial control plane, and re-expresses S/NC TV on
  that engine. Five child features: `editorial-engine`, `creator-content-playable`,
  `creator-enablement`, `identity-lifecycle`, `creator-programming-e2e`. Built on Liquidsoap 2.4.5.
  Verified end-to-end by machine proof (track-event → nowPlaying → HLS segment growth → browser
  decode → currentTime advance) — no human watching pixels.
- **Machine-verifiable testing** (`machine-verifiable-testing`, done 2026-06-29) — the testing
  infrastructure that *verifies* the channel model. Raises the verification ladder to
  machine-verifiable-by-default: `creator-channel-engine-e2e-infra` (the canonical rung-4-to-rung-3
  lift — stands up a creator-channel playout engine in the test stack), `e2e-harness-determinism`
  (profile-aware SRS callback limiter, clock-seed control, isolation proof, auth-limiter gate),
  `convention-machine-proof-carveout` (rewrote the fix-verify loopback convention), plus the browser
  decode + agent-vision pixel-inspection stories.
- **Playout admin redesign** (`playout-admin-redesign`) — responsive structure, honest-actions
  (queue honesty, channel lifecycle, toggle feedback), live-data.
- **Bold refactor spikes landed** — `bold-channel-topology-model-render` (topology as data, not
  string conventions), `bold-event-spine-publishers` (event bus: content events, input switch, queue
  events, wire proofs, SSE endpoint).
- **Liquidsoap 2.4.2 → 2.4.5** (`research-handoff-liquidsoap-version-capability-audit-1`) — the
  engine the editorial work builds on; staging-verified. Plus `liquidsoap-config-dir-portability`,
  `refactor-playout-playlist-path-env-var`.
- **Image-version pinning** (`pin-docker-compose-image-versions`) — tusd v2.9.2, imgproxy v3.31, SRS
  6.0.184; dev matches the prod deploy surface.
- **Streaming UX + fixes** — `streaming-playout-ux-review` (viewer/creator/admin/protocol audits),
  `live-player-control-bar-overflow`, `on-forward-session-first-classifier`, `live-experience-redesign`
  (page states, layout ergonomics, live-state spine store, notify-me dispatch + offline UI).

### Community + commerce

- **Email capture at shows** (`email-capture-at-shows`, 4 child stories) — capture audience emails
  at live shows (QR → 1-click signup) and register them as platform followers of the band, funneling
  into subscribe/donate. Native capture surface + contact/consent schema (`consent_log`,
  `creator_join_configs` tables, migrated) + creator QR settings + OTP sign-in (`sendOtpEmail` helper,
  `disableSignUp: false` so OTP auto-creates the account). Full flow built and on main; awaiting
  real-SMTP prod verification.

### Creators + admin + identity

- **Creator enablement** — API gate, channel-resolve, extract-surface, mount stories.
- **Creator streaming surface** — stream-key copy button, mobile form wrap, simulcast
  semantics/url-validation, key-revoke confirmation, manage stream keys simulcast.
- **A11y sweeps** — `a11y-creator-streaming-surface`, `a11y-admin-playout-console`,
  `a11y-viewer-chat-input-focus-ring`, `refactor-chart-tooltip-a11y`.

### Refactor + quality sweep

- **Refactor gate findings** — `refactor-concurrent-awaits`, `refactor-route-file-size-splits`,
  `refactor-jsdoc-exported-constants`, `refactor-component-splitting-oversized-files`,
  `refactor-pattern-compliance-sweep`, `refactor-draft-query-schema-pagination-factory`,
  `refactor-streaming-lifecycle-service-extraction`, `refactor-use-polling-hook-extraction`,
  `refactor-json-ld-typed-interfaces`, `refactor-playout-stream-names-dedup`.
- **Structural / shared** — `shared-confirm-dialog-component` (component + revoke convergence +
  simulcast adoption), `responsive-table-card-pattern`.
- **Bug fixes** — `calendar-task-checkbox-bug`, `calendar-event-patch-drops-visibility`,
  `hdr-video-tone-mapping`, `story-fix-garage-key-probe-fatal`, `content-media-stream-cache-control-stale`.
- **Playout queue cleanup** — `playout-queue-cleanup` + `bold-lifecycle-transitions-playout-queue`
  (3 steps).

### Developer experience + infra

- **Standalone devcontainer** — root's devcontainer delegates to platform's standalone one.
- **E2e browsers on demand** — Playwright browsers install on demand, not in the devcontainer lifecycle.
- **ARD kernel vendoring** — `vendor-ard-kernel-in-tree`, `replace-lint-citations-with-vendored-reference`,
  `slim-bump-research-band-rules-v0-4-1`, `ssrf-harden-lint-citations-url-alive`,
  `lint-research-claims-data-source-catalogs`.
- **Stack library gap audit** (handoff-1) — closes the tech-reference coverage gaps.

### Research engagements (inputs, NOT bundled)

The following `[research]` items are **not bound** to this release (research engagements are inputs
that ground other work, never shippable bundle members). Their actionable handoffs are bound above
where they produced shippable artifacts:
`liquidsoap-version-capability-audit` (handoff-1 bound), `stack-library-gap-audit` (handoff-1/-2 bound),
`research-pg-boss-vendored-source`, `stream-clipping-twitch-parity`, `video-production-media-hub`,
`research-srs/imgproxy/garage-vendored-source`, `events-integration-bandsintown-source-of-truth`.

## Bundle composition

- **151 bound items**: 4 epics, 34 features, 111 stories (plus this release orchestration item).
- Binding-consistency guard: **clean** — 0 CONFLICTs, 0 INCOMPLETEs under `epic_cohesion: total` +
  `binding_guard: halt`. Every epic/feature ships whole with its children.
- 87 archived stubs late-bound here (`archived_atop: 0.3.0` provenance — done atop the prior
  baseline, never previously released; 0 appear in the 0.3.0 shipped bundle).
- The 20 items bound by the original 2026-06-17 scoping pass are retained unchanged.

## Prod verification

Per platform's `release_mapping: none`, deployment is user-at-station (manual ship from the
operator's station). After `stage: released`, walk these prod-only checks that require production
credentials and can't run in CI:

- **Editorial engine on prod pipeline:** mode/manual after regenerate-restart, arm/take live, LRP
  pool rotation, the regenerate-restart cycle (note the ~10–30s per-channel output gap on restart
  while SRS releases the prior publish session).
- **Liquidsoap 2.4.5 prod ship-and-watch** (mitigation for thin automated regression coverage);
  revert plan = re-pin `v2.4.2` + rebuild.
- **Email capture at shows (NEW):** a creator configures a join page (manage UI), the QR resolves to
  `/join/<handle>` on the prod web origin, the OTP email delivers via real SMTP relay, a fan completes
  capture → consent log row written (GDPR provenance). Rides the same real-SMTP rung as the 0.3.0
  notification-email check.
- **`on-forward-session-first-classifier`:** a real creator RTMP push with active Twitch/YouTube
  simulcast destinations — confirm both external platforms go live AND S/NC TV takes over.
- **`systemd-graceful-exit`:** on the prod user-station host — `systemctl restart snc-api` completes
  within ~35s without hanging, no pg-boss lock leftovers.
- **`failed-upload-blocks-retry`:** upload killed mid-flight then retried — confirm no orphaned
  Garage multipart parts.
- **Resumable (tus) uploads on prod** (`tusd-prod-deploy-uploads-404`): a creator completes a
  `content-media` upload end-to-end on prod — blocked until the tusd prod deploy lands (tusd is not
  deployed to prod today; `/uploads/*` 404s). The deploy artifacts are drafted; this check is the
  gate that the deploy actually worked.

## Quality gate posture

Gates run at `release-deploy` against the combined deployment surface:
`gates_for_release: [security, tests, cruft, docs, patterns, refactor]`. Not yet run for 0.4.0.

## Gate runs
<populated as gates execute>
