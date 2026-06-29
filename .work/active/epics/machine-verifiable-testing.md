---
id: machine-verifiable-testing
kind: epic
stage: done
tags: [testing, workflow, developer-experience]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: null
created: 2026-06-26
updated: 2026-06-28
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

## Epic-design pass

Decomposition pre-existed from the 2026-06-26 scoping pass — five direct children are already
tracked under this epic. The children form a coherent ladder: convention first, harness determinism
as the scalable e2e substrate, L1-L2 playback infrastructure, L3 browser decode proof, and L4
vision triage. No new child features were spawned in this pass; the existing children are the
realized decomposition and are ready for their own feature/story design passes.

## Provenance

Adversarial e2e architecture review — Codex (`peeragent --agent codex --effort xhigh`),
2026-06-26. Findings verified against source before scoping (notably the `PRODUCTION_DEFAULTS`
drift and the integration-suite isolation pattern). Review log under `.peeragent/runs/`.

## Implementation summary

All five children reached `done`:

- `convention-machine-proof-carveout` (feature, `[prose]`) — the fix-verify loopback
  now has a machine-proof carve-out: human re-confirm required only where no
  deterministic proof exists; residual checks carry a paired backlog item with
  expiry; a green suite for a machine-provable surface is a valid close.
- `e2e-harness-determinism` (feature, 5 child stories) — deterministic
  test-control reset/seed API, clock/seed determinism, Playwright artifact
  retention + agent-readable failure triage, flake policy, and env-gated auth
  limiter relaxation for e2e.
- `creator-channel-engine-e2e-infra` (feature, 3 child stories) — the L1-L2
  machine proof for creator-channel queued-content playback: track-event →
  nowPlaying promotion + HLS segment growth, observed end-to-end without a
  human watching pixels. The canonical rung-4-to-rung-3 lift of this epic.
- `e2e-browser-decode-playback-proof` (story) — L3, the hard CI gate: drives
  the real Vidstack `<video>` element and asserts `readyState >= 2` plus
  `currentTime` advance. Deterministic, no vision model.
- `e2e-agent-vision-pixel-inspection` (story) — L4, advisory triage/debugging
  only, never a CI gate: a reusable visual-triage capture helper + triage-report
  surfacing + documented post-run agent vision runbook.

The verification ladder is now fully machine-verifiable-by-default: rungs 1-3
(unit → integration → e2e with L1-L2 pipeline proof + L3 browser decode gate)
are deterministic CI gates; rung 4 (the manual "open /live and watch" eyeball)
is retired for the creator-channel playback AC#5; rung 5 (prod-only) remains
legitimate and permanent. The L4 vision capability is additive triage
evidence, not a gate.

A parked backlog item (`idea-seed-demo-content-videos-lack-audio.md`) is the
audit trail for an inline seed-demo fix (content videos lacked an audio track,
which blocked the L1-L2 proof from passing — load-bearing).

## Review (final completion)

- Verdict: Approve with comments.
- Lane: deep (epic final completion review, fresh-context). Reviewer:
  openai-codex/gpt-5.5 (different model class than the implementing host).
- Scope: single cross-model fresh-context adversarial pass over the epic + all
  5 children + the commits of this autopilot run.
- No blockers, no important findings. Two nits, both on the parked backlog
  audit-trail item (`idea-seed-demo-content-videos-lack-audio.md`): timestamp
  ordering and an explicit "audit-only / fixed" marker. Both addressed: the
  item now carries consistent timestamps and an explicit "Audit-only — the bug
  is fixed; retain for traceability" note pointing at commit `95755bb`.
- The reviewer confirmed: the L1-L2 proof is not a tautology (polls `nowPlaying`
  + verifies new HLS segment URIs after a baseline); L3 is a real browser
  signal (native `<video>` `readyState >= 2` + `currentTime` advance); creator-
  channel rendering/prefetch is gated on `TEST_CONTROL_PROFILE === "e2e"`
  (production-safe); L4 vision is advisory-only and never contributes to CI
  pass/fail; all direct + nested children are `done` with no orphaned items;
  no foundation-doc drift.
