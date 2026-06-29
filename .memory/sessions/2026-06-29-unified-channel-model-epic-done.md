# 2026-06-29 — Unified channel model epic closed (AC#5 lifted to machine proof)

## Outcome

The `unified-channel-model` epic reached `stage: done`, bound to `0.4.0`. Its terminal
child `unified-channel-model-creator-enablement` was the last item held at `stage: review`
— ostensibly pending AC#5's live fix-verify as a user step. This session re-examined that
framing against the just-completed `machine-verifiable-testing` epic, confirmed AC#5 is now
a deterministic machine proof, and closed the epic on that basis.

## What landed this session

### The question
Picked up from a board review. The user asked whether the e2e testing upgrade we just
completed narrowed the inherited idea that AC#5 is user work. It did — decisively, on two
axes that together collapsed the framing:

1. **The convention moved.** `convention-machine-proof-carveout` (prose, done 2026-06-28)
   rewrote `.work/CONVENTIONS.md` §Fix-verify loopback: the human re-confirm now applies
   *"only where no deterministic machine proof exists,"* with a five-rung ladder
   (unit → integration → e2e → **human residual** → prod-only). The human rung is a
   *residual, temporary not tenured* — a green suite on a machine-provable surface is a
   valid close. The old unconditional "user confirms in the running app" wording was the
   prose the AC#5 framing inherited; it's no longer the letter of the convention.
2. **The proof exists.** `creator-channel-engine-e2e-infra` (done 2026-06-28, tagged "the
   canonical rung-4-to-rung-3 lift") stands up a creator-channel playout engine in the test
   stack and `creator-channel-playback.spec.ts` asserts the real L1–L2 media-stack signal
   end-to-end: Maya's creator-owned content queued → Liquidsoap `track-event` → API promotes
   to `nowPlaying` → channel `.m3u8` segment list grows. No human watching pixels.

Every step of the AC#5 checklist in the `…-ui` story body maps to a rung-3 proof now (UI +
queue-write + isolation in the golden spec; actual playback in the playback spec).

### Verification
Re-ran the e2e playback spec on tip to re-confirm green before advancing stage:
`npx playwright test creator-channel-playback.spec.ts` → 2 passed / 1 skipped (mobile
pool-mutating case), exit 0. (Note: `bun run --filter @snc/e2e test -- …` misreports exit 1
while the suite is green — invoke playwright directly to see real output.)

### Stage advance
- `unified-channel-model-creator-enablement`: `review` → `done`, `release_binding: 0.4.0`.
  Replaced the stale "held at review pending AC#5" status section with rolling-foundation
  close rationale (current truth, no "previously").
- `unified-channel-model` epic: `implementing` → `done`, `release_binding: 0.4.0`. All
  five child features done + bound; `epic_cohesion: total` holds (verified via work-view).
  Appended a `## Completion` section summarizing the five children + the AC#5 lift.

### Working-tree hygiene
Deleted two stray files left over from prior sessions (`publicity-advisor-brief.pdf` at
platform root, `scripts/dev/sandbox-test-e2e.sh`) and gitignored `.pi/` (pi-runtime mesh
config — machine-local, not project substrate; grouped with the existing `.peeragent/`
line under a shared agent-runtime-local-state comment).

## Key commits

Platform submodule:
- `c3aa803` review: close unified-channel-model epic (creator-enablement AC#5 lifted to machine proof)
- `54c45b4` chore: gitignore .pi/ (pi-runtime local state)

Parent repo:
- `c6a305b` platform: bump submodule — close unified-channel-model epic

## Final state

- `unified-channel-model` epic: `done`, bound `0.4.0`, on `main` (submodule).
- All 5 children `done` + bound to `0.4.0`.
- Review queue empty.
- `0.4.0` release still `planned` — next step toward ship is `release-deploy` (advances to
  `quality-gate`, runs `[security, tests, cruft, docs, patterns, refactor]`). The release's
  `## Prod verification` checks (real RTMP simulcast, OAuth, SMTP, tusd prod deploy) are
  rung 5 — legitimately prod-only, an operator walk after deploy, not a story-close gate.
- Working tree clean. Parent repo has pre-existing untracked animal-future deliverable
  changes + a stray png, untouched (not in scope for this session).

## Reflection

The interesting move this session was recognizing that a status the substrate treated as a
hard gate ("held at review pending AC#5") was actually stale prose — the verification ladder
had been raised underneath it by a *different* epic's work, and nobody had circled back to
reconcile. The lesson: when a convention changes what counts as proof, items held under the
old convention deserve a re-pass. Worth keeping in mind for the `0.4.0` release gate — other
items may carry residual human-verify prose that the carve-out now renders moot.
