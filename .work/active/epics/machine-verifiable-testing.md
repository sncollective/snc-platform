---
id: machine-verifiable-testing
kind: epic
stage: drafting
tags: [testing, workflow, developer-experience]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-26
updated: 2026-06-26
---

# Machine-verifiable-by-default testing

## Brief

Move platform verification from **human-by-default** to **machine-verifiable-by-default,
human-by-exception-with-an-expiry**. Today the close-condition for user-facing work is flat:
a human re-confirms the change in the running app (the fix-verify loopback). The single most
common instance is *"open `/live` and watch whether video plays"* — a manual eyeball that the
suite cannot yet replace, so the convention demands it every time.

This epic encodes one philosophy: **"works in the app" is a question the suite answers by
default; a human is asked only when no machine can yet answer, and every such ask carries a
backlog item to lift it up the verification ladder.** The human rung shrinks over time instead
of persisting.

This arc originated from an adversarial cross-model review (Codex, xhigh) of the platform e2e
architecture, the findings of which were verified against source. The accepted findings are
decomposed into the children below.

## The verification ladder (close-condition descent)

You fall to the next rung only when the rung above genuinely cannot reach:

1. **Unit** — pure logic/contracts (fake env, mocked externals).
2. **Integration** — real Postgres/Garage, real app assembly, real DB assertions.
3. **E2E (Playwright, full service-stack)** — real app + Postgres + Garage + SRS + Liquidsoap;
   includes playback via machine signals (`track-event → nowPlaying`, HLS segment growth,
   Vidstack `readyState`/`currentTime`).
4. **Human residual** — *only* what no rung above can yet prove; each carries a paired backlog
   item with an expiry. Meant to shrink.
5. **Prod-only verification** — OAuth, SMTP, real-follower paths, RTMP ingest. Genuinely needs
   production credentials/external systems; lives in `## Prod verification`. Legitimate and
   permanent — not failed automation.

The decisive shift: rung 4 ("open `/live` and watch") stops being the default and becomes a
temporary, tracked exception.

## Realized decomposition

- **`convention-machine-proof-carveout`** (`[prose]` feature) — amend `.work/CONVENTIONS.md`:
  the Fix-verify loopback gets a machine-proof carve-out (human re-confirm required *only* where
  no deterministic proof exists; residual checks carry a paired backlog item with expiry; a green
  suite for a machine-provable surface is a valid close). Also reframe the black-box boundary to
  *"no product assertions through the API"* — test-control APIs (reset/seed) and machine probes
  (`/status`, `.m3u8`, track-events) explicitly allowed; UI-only *assertions* retained.

- **`e2e-harness-determinism`** (feature) — the engineering that makes rung 3 the default at
  scale, sequenced **ahead of** the ~9 feature coverage specs in backlog. Deterministic
  test-control reset/seed API (adopt the integration suite's prefixed-fixtures +
  `cleanupFixtures()` clean-slate from `apps/api/tests/integration/creator-playout/cross-tenant-isolation.test.ts`
  so new specs drop serial/chromium-only partitioning), clock/seed determinism, Playwright
  artifact retention (trace+video) + agent-readable failure triage, a flake quarantine/rerun
  policy, and env-gating the strict auth limiter for the e2e/staging profile.

- **`creator-channel-engine-e2e-infra`** (story, P0) — lands the L1–L2 machine proof for creator
  playback (`track-event → nowPlaying` poll + HLS segment growth). Retires the manual AC#5
  playback eyeball — the canonical rung-4-to-rung-3 lift.

- **`e2e-browser-decode-playback-proof`** (story, L3) — Vidstack `<video>` `readyState`/
  `currentTime` advance. **The hard CI gate** for playback. Depends on the infra story.

- **`e2e-agent-vision-pixel-inspection`** (story, L4) — re-scoped from *CI gate* to
  *triage/debugging-only*: fuzzy and token-expensive, so it never gates CI; L3 is the hard gate.
  Vision is for failure triage and general "agent looks at the running app" debugging.

## Out of scope / sibling

`feature-flags-production-defaults-drift` (`[bug]`) — a doc/source drift surfaced by the same
review (docs reference a `PRODUCTION_DEFAULTS` preset that `features.ts` does not export; e2e
hard-codes its own `PROD_FLAGS`). Scoped standalone, not a child of this epic — it's a discrete
fix, not part of the ladder, though it strengthens the staging-fidelity claim the ladder leans on.

## Provenance

Adversarial e2e architecture review — Codex (`peeragent --agent codex --effort xhigh`),
2026-06-26. Findings verified against source before scoping (notably the `PRODUCTION_DEFAULTS`
drift and the integration-suite isolation pattern). Review log under `.peeragent/runs/`.
