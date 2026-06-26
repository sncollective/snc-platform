# 2026-06-26 — Machine-verifiable testing: adversarial e2e review → scoped a minimize-HITL epic

Drove an adversarial cross-model review of the platform e2e/testing architecture, then scoped
the verified findings into a coherent epic encoding a **machine-verifiable-by-default** testing
philosophy. No code changed — this session is substrate work (review + scope + park).

## The question
"If we designed from scratch to minimize human-in-the-loop visual/behavioral confirmation, are
we on the right track with the current framework + backlog?" The user's sharpest framing: kill
the blocking fix-verify step that amounts to *"open `/live` and see if video is playing."*

## What we did
1. **Adversarial review (Codex, `peeragent --agent codex --effort xhigh`, critique-only).**
   Pragmatic framing (keep Playwright + service-stack e2e). Returned 8 ranked findings; review log
   under `.peeragent/runs/`.
2. **Verified the two surprising findings against source** before scoping (substrate before
   stance):
   - **`PRODUCTION_DEFAULTS` drift is real** — `docs/feature-flags.md:9,38,63` references a
     `PRODUCTION_DEFAULTS` preset; `packages/shared/src/features.ts` exports only
     `ALL_FEATURES_ON`. And e2e doesn't consume a shared preset at all —
     `apps/e2e/playwright.config.ts:13` hard-codes its own `PROD_FLAGS` dict. The
     "staging mirrors prod flags" claim rests on a hand-copied dict that already drifted.
   - **A better isolation pattern already exists in-repo** — the integration suite uses prefixed
     fixtures + `cleanupFixtures()` clean-slate in `beforeEach`/`afterEach`
     (`apps/api/tests/integration/creator-playout/cross-tenant-isolation.test.ts:42,59,241`). The
     e2e suite reaches for UI-surgery reset instead only because it shares the demo DB.
3. **Scoped the epic** (`0b58505`) and **parked the UI/UX companion** (`f0bbdda`).

## Settled position: the verification ladder (close-condition descent)
"Works in the app" is a question the suite answers by default; a human is asked only when no
machine can yet answer, and **every such ask carries a backlog item with an expiry**. Rungs:
unit → integration → e2e (incl. playback via machine signals) → **human-residual-with-expiry** →
prod-only. The decisive shift: rung 4 ("open `/live` and watch") stops being the *default* and
becomes a *tracked, shrinking exception*. Prod-only (OAuth/SMTP/RTMP) stays — it's legitimate
un-automatable-in-CI work, not failed automation.

## What got scoped — `EPIC machine-verifiable-testing`
- **`convention-machine-proof-carveout`** `[prose]` — the change the user most wanted. Amends
  `.work/CONVENTIONS.md`: fix-verify loopback fires **only where no deterministic machine proof
  exists**; a green suite for a machine-provable surface is a valid close; residual human checks
  get a paired backlog item with expiry. Also reframes the black-box boundary from "no API probes"
  to **"no *product assertions* through the API"** — test-control APIs (reset/seed) and machine
  probes (`/status`, `.m3u8`, track-events) explicitly allowed; UI-only *assertions* retained.
- **`e2e-harness-determinism`** — the harness that makes rung-3 cheap at scale, **sequenced ahead
  of the ~9 feature coverage specs**: test-control reset/seed API (adopt the integration suite's
  clean-slate pattern → drop serial/chromium-only partitioning), clock/seed determinism, Playwright
  artifact retention (trace+video) + agent-readable triage, flake quarantine policy, auth-limiter
  env-gating. Absorbs backlog `e2e-suite-self-rate-limits-auth` at decomposition (left in backlog
  for now — deleting before the absorbing story exists would lose detail).
- **`creator-channel-engine-e2e-infra` (P0)** — pulled active; lands the L1–L2 machine proof
  (`track-event → nowPlaying` + HLS segment growth). The canonical rung-4→rung-3 lift that retires
  the AC#5 playback eyeball.
- **`e2e-browser-decode-playback-proof` (L3)** — Vidstack `readyState`/`currentTime` advance. **The
  hard CI gate** for playback. Depends on the infra story.
- **`e2e-agent-vision-pixel-inspection` (L4)** — **re-scoped CI-gate → triage-only**. Vision is
  fuzzy *and* token-expensive (user agreed); L3 is the gate. Vision's value is failure triage +
  general "agent looks at the running app" debugging.
- Standalone: **`feature-flags-production-defaults-drift` `[bug]`** — the verified drift above.

## Parked: the other half of minimize-HITL
`visual-verification-design-upfront` — retires **"is the box in the right place / does it look
good"** eyeballing (distinct from the functional-verification epic). The lever: design-upfront
produces the *oracle* (mockup/token spec) that makes "looks right" machine-answerable;
visual-regression snapshots *enforce* it. Grounded: token surface exists (`global.css`), but no
`.mockups/`, no ux-ui-design plugin installed, visual regression is currently **manual** (e.g.
0.3.0's `design-system-foundation-token-restructuring` has a literal "Visual Regression: Manual
Verification" section), no Playwright snapshot capability wired. Scope-time questions flagged:
**(1)** ux-ui-design plugin (nklisch/skills) compatibility against our `global.css`
`var(--token-name)` tokens — the agile-workflow `scope` skill already has conditional
`/ux-ui-design:palette|flows` hooks, so the seam exists; the open question is surface
compatibility; **(2)** a flake-aware snapshot strategy (viewport/font pinning — the harness
feature's determinism work is the foundation — dynamic-region masking, baseline-update workflow),
or it adds babysitting instead of removing it.

## Next
- `/agile-workflow:epic-design machine-verifiable-testing` to decompose.
- The `[prose]` convention feature → `/agile-workflow:prose-author` (design is in its body).
- `creator-channel-engine-e2e-infra` → `/agile-workflow:e2e-test-design` to decompose steps 3–4.
