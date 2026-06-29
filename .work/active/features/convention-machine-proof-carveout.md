---
id: convention-machine-proof-carveout
kind: feature
stage: done
tags: [prose, workflow, testing]
parent: machine-verifiable-testing
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-26
updated: 2026-06-28
---

# Convention edit: machine-proof carve-out for fix-verify + black-box reframe

## Brief

Two prose edits to `.work/CONVENTIONS.md` that convert the testing philosophy from
human-by-default to machine-by-default. No code surface — this is a `[prose]` feature; design
and authoring collapse into the edit itself.

## Edit 1 — Fix-verify loopback machine-proof carve-out (`### Fix-verify loopback`)

Today the section reads as unconditional: *"Each user-verifiable fix is re-confirmed by the user
before the story closes ... A review that passes without the user having exercised the change is
not complete under this convention."* There is no escape clause for "a machine proof exists,"
so even after the playback ladder lands, the letter of the convention still demands a human open
`/live`.

Add a carve-out making the human step **conditional**:

- The fix-verify loopback applies **only where no deterministic machine proof** (unit /
  integration / e2e) exists for the change.
- Where a machine proof exists, **a green suite for the machine-provable surface is a valid
  close** — no human re-confirmation required.
- Where a change is user-verifiable but **not yet** machine-provable, the human re-confirm is a
  **residual**, and the story must carry (or link) a **paired backlog item with an expiry** to
  lift that check up the verification ladder. The human rung is temporary, not tenured.
- Genuinely prod-only checks (OAuth, SMTP, real-follower paths, RTMP ingest) are unaffected —
  they remain in `## Prod verification`, which is legitimate un-automatable-in-CI work, not a
  failed automation.

State the five-rung verification ladder (unit → integration → e2e → human-residual-with-expiry
→ prod-only) so the carve-out reads as a descent, not a loophole. Mirror the epic
(`machine-verifiable-testing`) framing.

## Edit 2 — Black-box boundary reframe

The e2e suite carries a committed black-box boundary — currently understood as "no API probes"
(`creator-programming.spec.ts:63`). That is too absolute: setup already mints auth over HTTP
(`global.setup.ts:9`), and the absolute rule forces slow/brittle UI proxies for things a probe
asserts cheaply, working *against* fast machine verification.

Reframe the boundary (add it to `## Platform-local conventions`, or extend the e2e-testing rule
reference) as:

- **No *product assertions* through the API.** Test *assertions* about user-facing behavior stay
  UI-only — the suite proves what a user would see.
- **Test-control APIs are allowed** for setup/reset/seed (the deterministic clean-slate the
  harness feature builds).
- **Machine probes are allowed** for proof-of-pipeline signals: `/status` (`nowPlaying`), the
  channel `.m3u8` (segment growth), track-events — the L1–L2 playback proofs. These are not
  product assertions; they are the machine rung of the ladder.

## Acceptance

- `### Fix-verify loopback` carries the machine-proof carve-out + residual-with-expiry rule +
  the five-rung ladder.
- The black-box boundary is reframed to "no product assertions through the API" with the
  test-control / machine-probe allowances stated.
- No "previously"/migration prose — rolling-foundation: the convention states current truth,
  git carries the history.

## Notes

`[prose]` — routes to `prose-author`, not `feature-design`. Single authoring stride; no child
stories, no code, no exploratory sub-agents.

## Implementation notes

- Files changed: `.work/CONVENTIONS.md`, `AGENTS.md`
- Tests added: none — prose/convention change only.
- Discrepancies from design: fresh-context review found `AGENTS.md` still carried the old unconditional loopback wording; fixed so the dense agent entry point matches `.work/CONVENTIONS.md`.
- Adjacent issues parked: none.

## Review (2026-06-28)

**Verdict**: Approve

**Blockers**: none
**Important**: none
**Nits**: none

**Notes**: Deep feature review via fresh-context subagent. Initial review requested changes because `AGENTS.md` still carried the old unconditional loopback wording and `.work/CONVENTIONS.md` had stale "Both" wording; both were fixed in `111c4cf`. Re-review approved with no findings.
