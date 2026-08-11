# Changelog

All notable changes to the S/NC platform are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/) (pre-1.0; 1.0 reserved for cooperative launch).

Releases are **scoping units, not deployment units** (`release_mapping: none`): development
happens on `main`, and deployment ships everything reviewed at the operator's station. Each
release's prod-only verification checks live in its release file.

## v0.4.0 — Post-0.3.0 Platform Sweep

2026-06-29 — the full unreleased surface since 0.3.0 (2026-04-24). Four epics land
(`unified-channel-model`, `machine-verifiable-testing`, `live-experience-redesign`,
`playout-admin-redesign`), the `email-capture-at-shows` commerce capability ships, and a
broad refactor / accessibility / testing / dev-experience sweep runs across every surface.
**199 bound items** (4 epics, 34 features, 160 stories) + gate findings drained across two
gate-loop iterations.

### Streaming + Playout

- **Unified channel model** — every channel is now a single continuous program source with an
  editorial control plane, and S/NC TV is re-expressed on that engine. Per-channel editorial
  config (source tiers: live / queue+pool / channel-as-source; manual|auto mode; arm/take),
  the unified program-source model (operator queue auto-fills from a pool; auto = readiness
  fallback), and bespoke per-channel harbor control endpoints (queue/skip/now-playing/arm).
  Migrations 0029–0031.
- **Liquidsoap 2.4.2 → 2.4.5** — the playout-engine base pin the editorial work builds on;
  staging-verified (clock-detach-while-running, sub-clock CPU growth, harbor/skip crash fixes).
- **Playout admin redesign** — responsive structure, honest-actions (queue honesty, channel
  lifecycle, toggle feedback), live-data.
- **Bold refactor spikes landed** — channel-topology render (topology as data, not string
  conventions smeared across 5 files), event-spine publishers (event bus: content events, input
  switch, queue events, wire proofs, SSE endpoint).
- **Streaming UX + fixes** — playout UX review (viewer/creator/admin/protocol audits),
  live-page player controls, `on-forward-session-first-classifier` (creator RTMP → external
  Twitch/YouTube simulcast), live-experience redesign (page states, layout ergonomics, live-state
  spine store, notify-me dispatch + offline UI).
- **Hardening** — Liquidsoap harbor mutating endpoints now secret-gated (`PLAYOUT_CALLBACK_SECRET`,
  fail-closed); RTMP callback payloads redacted (allowlist) so stream keys no longer leak into
  stored event/session data; playout-orchestrator split into focused modules; streaming route
  decomposed into a callbacks service.

### Community + Commerce

- **Email capture at shows** — capture audience emails at live shows (QR → 1-click signup) and
  register them as platform followers of the band, funneling into subscribe/donate. Native capture
  surface + `consent_log` / `creator_join_configs` schema (migrated) + creator QR settings +
  OTP sign-in (`sendOtpEmail`, `disableSignUp: false` so OTP auto-creates accounts). The complete
  flow is on main; client-attested `policyVersion` consent provenance; join completion requires a
  verified email.

### Creators + Admin + Identity

- **Creator enablement** — API gate, channel-resolve, extract-surface, mount.
- **Creator streaming surface** — stream-key copy, mobile form wrap, simulcast
  semantics/url-validation, key-revoke confirmation, manage stream keys. Simulcast destinations now
  carry an SSRF guard (private/link-local/internal host blocking).
- **A11y sweeps** — creator-streaming surface, admin playout console, viewer chat input focus ring,
  chart tooltip a11y, new-channel input label.

### Refactor + Quality

- **Refactor sweep** — concurrent-awaits, route-file-size splits, component splitting, JSDoc
  constants, pattern-compliance sweep, streaming-lifecycle extraction, playout stream-name dedup,
  pagination-factory, use-polling hook extraction, JSON-LD typed interfaces.
- **Structural / shared** — shared confirm dialog (component + revoke convergence + simulcast
  adoption), responsive table/card pattern, duration-format dedup, picker dismiss hook.
- **Bug fixes** — calendar task checkbox, calendar event visibility clobber, HDR video tone mapping,
  Garage key-probe fatal, content-media stream cache-control stale.
- **Playout queue cleanup** + bold lifecycle-transitions queue.

### Developer Experience + Infra

- **Standalone devcontainer** — root's devcontainer delegates to platform's standalone one.
- **E2e browsers on demand** — Playwright browsers install on demand, not in the devcontainer lifecycle.
- **ARD kernel vendoring** — in-tree kernel, vendored-reference lint citations, research-band rules,
  SSRF hardening on lint-citation URLs, data-source-catalogs lint.
- **Image-version pinning** — tusd v2.9.2, imgproxy v3.31, SRS 6.0.184 (dev matches the prod deploy
  surface).

### Machine-Verifiable Testing

- **Testing infrastructure** — raises the verification ladder to machine-verifiable-by-default:
  `creator-channel-engine-e2e-infra` (stands up a creator-channel playout engine in the test stack —
  the canonical rung-4-to-rung-3 lift), `e2e-harness-determinism` (profile-aware SRS callback
  limiter, clock-seed control, isolation proof, auth-limiter gate), the convention rewrite that
  makes a green machine proof a valid close, plus browser-decode + agent-vision pixel-inspection
  stories. The real L1–L2–L3 machine proof (track-event → nowPlaying → HLS segment growth → browser
  decode → currentTime advance) passes end-to-end — no human watching pixels.
- **Test-control surface** — e2e-only, now secret-gated (`x-test-control-secret`, fail-closed) so
  profile misconfiguration can't expose destructive reset/seed.

### Patterns catalog

42 documented project patterns (31 → 42 this release): editorial-engine architecture
(`structural-edit-regenerate-restart`, `fire-and-forget-event-publish`, `exactly-one-source-contract`,
`scoped-editorial-adapter-bundles`, `channel-derived-pool-scope-query-guard`,
`typed-sse-event-registry`), testing (`e2e-test-control-state-bracket`, `bounded-expect-poll-probe`,
`stable-e2e-fixture-family-ids`), and UI (`controlled-confirm-dialog`,
`responsive-table-dual-render`, `use-polling`).

### Quality gate posture

Six gates (`security, tests, cruft, docs, patterns, refactor`) ran over the combined deployment
surface across the original pass + two rerun iterations. **15 blocking findings drained** (all
criticals/highs fixed and verified green); accepted medium/low debt tracked in
`040-known-debt-gate-rerun-1` (does not block ship). Security gate clean on rerun-2.

### Prod verification (operator-at-station)

Per `release_mapping: none`, walk these prod-only checks after deploy:
- Editorial engine on prod pipeline (mode/manual, arm/take, LRP pool rotation, regenerate-restart).
- Liquidsoap 2.4.5 prod ship-and-watch (revert = re-pin v2.4.2 + rebuild).
- Email capture at shows (creator configures join page → QR → OTP delivers via real SMTP → consent
  log written).
- `on-forward-session-first-classifier` (real creator RTMP with active simulcast destinations).
- `systemd-graceful-exit` (prod user-station: restart completes ~35s, no pg-boss lock leftovers).
- `failed-upload-blocks-retry` (killed-mid-flight retry, no orphaned Garage parts).
- Resumable (tus) uploads on prod (blocked until tusd prod deploy lands).
